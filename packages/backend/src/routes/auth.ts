import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { sessionPool } from '../lib/db.js';

export const authRouter = Router();

// ─── Validation schemas ──────────────────────────────────────────────────────

const loginValidation = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const registerValidation = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 2, max: 100 }).withMessage('Username must be 2-100 characters'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

// D-04/D-05: self-service password change — only the new password reaches the server.
// The confirm-field match is a client-only UX check (never sent). Server re-validates the
// 8-char minimum (CLAUDE.md Rule 9 — never trust client-only validation).
const changePasswordValidation = [
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

// ─── POST /api/auth/login ────────────────────────────────────────────────────
// AUTH-01: login with username + password
// AUTH-02: session persists until explicit logout (rolling: true already in app.ts)
// CONTEXT.md D-10: returns role so frontend can redirect (admin→/dashboard, mod→/sales)
// SECURITY: session.regenerate() before setting userId prevents session fixation
// SECURITY: generic 'INVALID_CREDENTIALS' error prevents username enumeration

authRouter.post('/login', loginValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
    return;
  }

  const { username, password } = req.body as { username: string; password: string };

  // findFirst with explicit isActive: true (not covered by $extends softDeleteFilter for findFirst)
  const user = await prisma.user.findFirst({
    where: { username, isActive: true, organizationId: 1 },
  });

  // Constant-time comparison via bcrypt.compare prevents timing attacks
  // Run bcrypt.compare even when user is null (with a dummy hash) to prevent timing enumeration
  const dummyHash = '$2b$12$invaliddummyhashtopreventtimingattacks00000000000000000000';
  const passwordMatch = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);

  if (!user || !passwordMatch) {
    res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    return;
  }

  // SECURITY: regenerate session ID before setting data — prevents session fixation
  await new Promise<void>((resolve, reject) =>
    req.session.regenerate((err) => (err ? reject(err) : resolve()))
  );

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.username = user.username;
  req.session.organizationId = user.organizationId;

  // RESEARCH.md Pitfall 4: save before responding — async session write must complete first
  await new Promise<void>((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve()))
  );

  res.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      canEdit: user.canEdit,
      organizationId: user.organizationId,
    },
  });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
// Returns the current session's user object.
// Called on every app load to rehydrate Zustand auth state after a page refresh.
// requireAuth returns 401 if no session — frontend init treats 401 as unauthenticated.
// DB lookup is required because canEdit is not stored in the session.

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    select: { id: true, username: true, role: true, canEdit: true, organizationId: true, isActive: true },
  });

  if (!user || !user.isActive) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }

  res.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      canEdit: user.canEdit,
      organizationId: user.organizationId,
    },
  });
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
// AUTH-03: logs out from any page, invalidates session immediately

authRouter.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'LOGOUT_FAILED' });
      return;
    }
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

// ─── POST /api/auth/invite ───────────────────────────────────────────────────
// AUTH-04: admin generates invite link
// CONTEXT.md §Specifics: raw token in URL, sha256 hash stored in DB
// Security: 32 bytes = 256-bit token space; timing attacks prevented by hash lookup

authRouter.post('/invite', requireAuth, requireRole('admin'), async (req, res) => {
  const rawToken = crypto.randomBytes(32).toString('base64url'); // 43 URL-safe chars
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

  await prisma.inviteToken.create({
    data: {
      tokenHash,
      role: 'moderator', // always moderator — admin accounts are not invite-created in v1
      createdById: req.session.userId!,
      expiresAt,
      organizationId: 1,
    },
  });

  // Derived from the incoming request (not CLIENT_ORIGIN) so the link is always correct
  // regardless of which domain/tunnel it was reached through (e.g. Cloudflare Tunnel).
  // Requires app.set('trust proxy', ...) so req.protocol reflects X-Forwarded-Proto.
  const origin = `${req.protocol}://${req.get('host')}`;
  res.status(201).json({ inviteUrl: `${origin}/invite/${rawToken}` });
});

// ─── GET /api/auth/invite/:token ─────────────────────────────────────────────
// AUTH-05/AUTH-06: validate invite token WITHOUT consuming it
// RESEARCH.md Pitfall 7: GET is stateless — no usedAt mutation here
// Frontend uses this to decide whether to render the form or the expired-state card

authRouter.get('/invite/:token', async (req, res) => {
  const tokenHash = crypto.createHash('sha256').update(req.params.token as string).digest('hex');
  const invite = await prisma.inviteToken.findUnique({ where: { tokenHash } });

  if (!invite || invite.usedAt !== null || invite.expiresAt < new Date()) {
    res.status(400).json({ error: 'INVITE_INVALID' });
    return;
  }

  res.json({ valid: true });
});

// ─── POST /api/auth/invite/:token ────────────────────────────────────────────
// AUTH-05: register via invite link — consumes token (sets usedAt) + creates user
// AUTH-06: validates token not used and not expired before consuming

authRouter.post('/invite/:token', registerValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
    return;
  }

  const tokenHash = crypto.createHash('sha256').update(req.params.token as string).digest('hex');
  const { username, password } = req.body as { username: string; password: string };

  // WR-01: Hash BEFORE opening the transaction — bcrypt with cost 12 takes ~100-300ms of CPU
  // time and would hold a DB connection open for its entire duration inside a transaction.
  // Under load this can exhaust the connection pool and trigger transaction timeouts.
  const passwordHash = await bcrypt.hash(password, 12); // cost factor 12 per CLAUDE.md

  await prisma.$transaction(async (tx) => {
    const invite = await tx.inviteToken.findUnique({ where: { tokenHash } });

    if (!invite || invite.usedAt !== null || invite.expiresAt < new Date()) {
      const err = Object.assign(new Error('Invite link is invalid or has expired'), {
        statusCode: 400, code: 'INVITE_INVALID',
      });
      throw err;
    }

    // Mark token as used BEFORE creating user (prevents race condition on concurrent submits)
    await tx.inviteToken.update({
      where: { tokenHash },
      data: { usedAt: new Date() },
    });

    await tx.user.create({
      data: {
        username,
        passwordHash,
        role: invite.role,
        organizationId: invite.organizationId,
      },
    });
  });

  res.status(201).json({ ok: true });
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────
// Phase 8: self-service password change for the CURRENTLY logged-in user (admin or moderator).
// D-01: no role branching — any authenticated user may change their own password.
// D-03: no current-password field (confirmed user decision — internal tool, trusted team).
// D-06: invalidate all of THIS user's OTHER sessions but PRESERVE the current one (req.sessionID).
//       This is the ONE point of divergence from users.ts admin-reset, which kills every session.
// requireAuth is per-route because authRouter is mounted unauthenticated in app.ts (see GET /me).
authRouter.post('/change-password', requireAuth, changePasswordValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
    return;
  }

  const { newPassword } = req.body as { newPassword: string };

  // Hash before touching the DB — bcrypt cost 12 per CLAUDE.md (same as invite register + admin reset).
  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Update ONLY the caller's own row — id comes from the session, never from the request body,
  // so a user can never change another account's password (Rule 9 backend RBAC enforcement).
  await prisma.user.update({
    where: { id: req.session.userId!, organizationId: req.session.organizationId! },
    data: { passwordHash },
  });

  // D-06: kill every OTHER session for this user, but keep the current one alive.
  // session_id is the express-session primary key (== req.sessionID); excluding it preserves
  // the requester's login. Cannot reuse the admin-reset query verbatim — that deletes ALL sessions.
  await sessionPool.query(
    `DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ? AND session_id != ?`,
    [req.session.userId, req.sessionID],
  );

  // No password is echoed back (unlike admin reset which returns tempPassword) — mirror /logout's shape.
  res.json({ ok: true });
});
