import { Router } from 'express';
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

usersRouter.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({
    where: {
      organizationId: 1,
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
  async (req, res) => {
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
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
      return;
    }

    const targetId = Number(req.params.id);
    const user = await prisma.user.update({
      where: { id: targetId, organizationId: 1 },
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
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
    return;
  }
  const targetId = Number(req.params.id);

  // Verify target user exists and belongs to this org
  const target = await prisma.user.findFirst({
    where: { id: targetId, organizationId: 1, isActive: undefined },
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
    where: { id: targetId, organizationId: 1 },
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
