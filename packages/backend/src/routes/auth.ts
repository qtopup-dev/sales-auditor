import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../middleware/requireRole.js';

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

// ─── POST /api/auth/login ────────────────────────────────────────────────────
// AUTH-01: login with username + password
// AUTH-02: session persists until explicit logout (rolling: true already in app.ts)
// CONTEXT.md D-10: returns role so frontend can redirect (admin→/dashboard, mod→/sales)
// SECURITY: session.regenerate() before setting userId prevents session fixation
// SECURITY: generic 'INVALID_CREDENTIALS' error prevents username enumeration

authRouter.post('/login', loginValidation, async (req, res) => {
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

authRouter.post('/invite', requireRole('admin'), async (req, res) => {
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

  const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
  res.status(201).json({ inviteUrl: `${clientOrigin}/invite/${rawToken}` });
});

// ─── GET /api/auth/invite/:token ─────────────────────────────────────────────
// AUTH-05/AUTH-06: validate invite token WITHOUT consuming it
// RESEARCH.md Pitfall 7: GET is stateless — no usedAt mutation here
// Frontend uses this to decide whether to render the form or the expired-state card

authRouter.get('/invite/:token', async (req, res) => {
  const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
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

authRouter.post('/invite/:token', registerValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
    return;
  }

  const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');

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

    const { username, password } = req.body as { username: string; password: string };
    const passwordHash = await bcrypt.hash(password, 12); // cost factor 12 per CLAUDE.md

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
