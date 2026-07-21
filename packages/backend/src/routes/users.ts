import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { sessionPool } from '../lib/db.js';
import { requireRole } from '../middleware/requireRole.js';

export const usersRouter = Router();

// All /api/users/* routes require admin role.
// requireRole is mounted at router level — ROLES-09 compliance.
usersRouter.use(requireRole('admin'));

// ─── GET /api/users ──────────────────────────────────────────────────────────
// Returns all users (active and inactive) — admin catalog
// isActive: undefined overrides the $extends default — Boolean fields do not support { in: [...] }.
// ROLES-01: returns role field for display

usersRouter.get('/', async (req, res) => {
  const users = await prisma.user.findMany({
    where: {
      organizationId: req.session.organizationId!,
      isActive: undefined, // override $extends default — show all (active + inactive)
    },
    select: {
      id: true,
      username: true,
      role: true,
      canEdit: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      organizationId: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json(users);
});

// ─── PATCH /api/users/:id/username ───────────────────────────────────────────
// USERS-03: admin edits any user's username
// D-20/D-21: validate non-empty 2–100 chars, unique within organizationId (excluding self)
// ROUTING: this handler MUST appear BEFORE PATCH /:id to avoid Express capturing "username" as :id
// usersRouter already mounts requireRole('admin') at router level — no extra guard needed here

usersRouter.patch(
  '/:id/username',
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid user ID'),
    body('username')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Username must be 2–100 characters'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
      return;
    }

    const targetId = Number(req.params.id);
    const username = (req.body.username as string).trim();
    const organizationId = req.session.organizationId!;

    // D-21: uniqueness check excluding self — check active + inactive users (isActive: undefined)
    // isActive: undefined overrides $extends softDeleteFilter — checks ALL users regardless of isActive
    const conflict = await prisma.user.findFirst({
      where: {
        username,
        organizationId,
        NOT: { id: targetId },
        isActive: undefined, // override $extends — check ALL users regardless of isActive
      },
    });
    if (conflict) {
      res.status(409).json({ error: 'USERNAME_TAKEN' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: targetId, organizationId },
      data: { username },
      select: {
        id: true,
        username: true,
        role: true,
        canEdit: true,
        isActive: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json(updated);
  },
);

// ─── PATCH /api/users/:id ────────────────────────────────────────────────────
// ROLES-02: toggle canEdit on/off for a moderator
// Accepts: { canEdit: boolean }
// Does NOT allow changing role or isActive via this endpoint (those are separate actions)

usersRouter.patch(
  '/:id',
  [param('id').isInt({ min: 1 }).withMessage('Invalid user ID'), body('canEdit').isBoolean().withMessage('canEdit must be a boolean')],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
      return;
    }

    const targetId = Number(req.params.id);
    const organizationId = req.session.organizationId!;

    // WR-04: enforce moderator-only — admins cannot have canEdit toggled
    const target = await prisma.user.findFirst({
      where: { id: targetId, organizationId },
      select: { role: true },
    });
    if (!target) {
      res.status(404).json({ error: 'USER_NOT_FOUND' });
      return;
    }
    if (target.role !== 'moderator') {
      res.status(400).json({ error: 'CANNOT_EDIT_ADMIN_RIGHTS' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: targetId, organizationId },
      data: { canEdit: req.body.canEdit as boolean },
      select: {
        id: true,
        username: true,
        role: true,
        canEdit: true,
        isActive: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json(user);
  },
);

// ─── POST /api/users/:id/reset-password ──────────────────────────────────────
// AUTH-07: admin resets any user's password
// CONTEXT.md D-01: backend generates temp password, returns plaintext ONCE
// CONTEXT.md D-02: no mustChangePassword flag
// CONTEXT.md D-03: all active sessions for target user are immediately invalidated
// RESEARCH.md Pattern 5: direct DELETE SQL is correct approach (O(1) vs O(n) sessionStore.all())

usersRouter.post(
  '/:id/reset-password',
  [param('id').isInt({ min: 1 }).withMessage('Invalid user ID')],
  async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
    return;
  }
  const targetId = Number(req.params.id);

  // Verify target user exists and belongs to this org
  const orgId = req.session.organizationId!;
  const target = await prisma.user.findFirst({
    where: { id: targetId, organizationId: orgId, isActive: undefined },
    select: { id: true },
  });
  if (!target) {
    res.status(404).json({ error: 'USER_NOT_FOUND' });
    return;
  }

  // Generate 12-char URL-safe temporary password (crypto.randomBytes per CONTEXT.md §Specifics)
  const tempPassword = crypto.randomBytes(9).toString('base64url'); // 12-char base64url
  const passwordHash = await bcrypt.hash(tempPassword, 12); // cost 12 per CLAUDE.md

  // Update passwordHash in DB
  await prisma.user.update({
    where: { id: targetId, organizationId: orgId },
    data: { passwordHash },
  });

  // Invalidate all active sessions for this user via direct SQL DELETE
  // RESEARCH.md Pattern 3: JSON_EXTRACT(data, '$.userId') matches the session data JSON
  // ASSUMPTION A2: sessions table data column stores { userId: <number> } — verify if 401s persist after reset
  await sessionPool.query(
    `DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ?`,
    [targetId],
  );

  // Return temp password ONCE — admin copies and shares verbally or via direct message (D-01)
  res.json({ tempPassword });
});

// ─── DELETE /api/users/:id ────────────────────────────────────────────────────
// CONTEXT.md D-01: sets deletedAt (a second, stricter soft-delete signal distinct from isActive).
// CONTEXT.md D-08: blocks self-delete using req.session.userId (server-side truth, never the body).
// CONTEXT.md D-09: blocks deleting the organization's last remaining admin — race-safe via a
// SELECT ... FOR UPDATE row lock on ALL of the org's admin rows (the target is NOT excluded in the
// SQL; "other admin" is computed in application code) inside a transaction, so two concurrent
// delete requests for two different admins cannot both pass the count check and leave zero admins.
// CONTEXT.md D-10: kills ALL sessions for the deleted user — no session_id exclusion (unlike
// auth.ts's /change-password route, which preserves the requester's own current session).

usersRouter.delete(
  '/:id',
  [param('id').isInt({ min: 1 }).withMessage('Invalid user ID')],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
      return;
    }

    const targetId = Number(req.params.id);
    const organizationId = req.session.organizationId!;

    // D-08: block self-delete — checked BEFORE any DB read/write, using the server-side session,
    // never any client-supplied value.
    if (targetId === req.session.userId) {
      res.status(400).json({ error: 'CANNOT_DELETE_SELF' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Existence check bypasses isActive (undefined = include inactive-but-not-deleted rows),
      // but KEEPS deletedAt: null enforced — an already-deleted user is treated as not-found.
      const target = await tx.user.findFirst({
        where: { id: targetId, organizationId, isActive: undefined, deletedAt: null },
        select: { id: true, role: true, isActive: true },
      });
      if (!target) {
        throw Object.assign(new Error('User not found'), {
          statusCode: 404, code: 'USER_NOT_FOUND',
        });
      }

      // D-09: race-safe last-admin guard. FOR UPDATE locks ALL of the organization's admin rows
      // (INCLUDING the target row — it is deliberately NOT excluded in the SQL) for the duration of
      // this transaction. Two concurrent DELETEs targeting two DIFFERENT admins in the same org
      // therefore lock the SAME row set and contend: the second blocks until the first commits or
      // rolls back, then re-reads the (now smaller) locked set and correctly sees zero other admins.
      // The "other admin" count is computed in application code by filtering the target out of the
      // locked result set. (If the target row were excluded from this SQL via an id-inequality
      // predicate, the two transactions would lock DISJOINT rows, never contend, and both could
      // commit — leaving zero admins. That exclusion is intentionally absent.)
      // D-09 (PHASE9-SC5 / CR-01 fix): the guard counts only admins who can actually LOG IN.
      // It runs ONLY when the target is itself an ACTIVE admin — deleting a deactivated
      // (isActive: false) admin can never reduce the usable-admin count, so it is never blocked.
      // The FOR UPDATE set is restricted to isActive = true so a deactivated-but-not-deleted admin
      // does NOT count as "another usable admin" (auth.ts login requires isActive: true AND
      // deletedAt: null — a deactivated admin genuinely cannot authenticate). Race-safety is
      // preserved: the target (active) is INCLUDED in the locked set (not excluded in SQL), so two
      // concurrent deletes of two different active admins lock the identical set and contend.
      if (target.role === 'admin' && target.isActive) {
        const admins = await tx.$queryRaw<{ id: number }[]>`
          SELECT id FROM users
          WHERE organizationId = ${organizationId}
            AND role = 'admin'
            AND deletedAt IS NULL
            AND isActive = true
          FOR UPDATE
        `;
        const otherAdmins = admins.filter((a) => a.id !== targetId);
        if (otherAdmins.length === 0) {
          throw Object.assign(new Error('Cannot delete the last remaining admin'), {
            statusCode: 400, code: 'LAST_ADMIN',
          });
        }
      }

      await tx.user.update({
        where: { id: targetId, organizationId },
        data: { deletedAt: new Date() },
      });
    });

    // D-10: kill EVERY session for this user — unconditional, no session_id exclusion.
    // Runs AFTER the transaction commits, mirroring the reset-password route's ordering.
    await sessionPool.query(
      `DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ?`,
      [targetId],
    );

    res.status(204).send();
  },
);
