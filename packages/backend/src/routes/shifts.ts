import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const shiftsRouter = Router();

// shiftsRouter does NOT mount requireRole at router level — every route here is open to
// any authenticated user. In practice only moderators call these (D-05: admins never clock
// in), but that is enforced by the frontend only showing ClockControl for role === 'moderator'.
// requireAuth is already applied at the protectedRouter level in app.ts.

// ─── Serializer ───────────────────────────────────────────────────────────────
function serializeShift(s: {
  id: number;
  organizationId: number;
  userId: number;
  clockInAt: Date;
  clockOutAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: s.id,
    organizationId: s.organizationId,
    userId: s.userId,
    clockInAt: s.clockInAt.toISOString(),
    clockOutAt: s.clockOutAt ? s.clockOutAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

// ─── POST /api/shifts/clock-in ────────────────────────────────────────────────
// D-01: one open shift per moderator, enforced server-side. A clock-in attempt while one
// is already open no-ops into returning the existing open shift (never an error).
// T-07-01: the DB-level `openLock` unique index (see Plan 01 migration) makes this race-safe
// even under concurrent double-click — a losing request gets a P2002 error, caught below.
shiftsRouter.post('/clock-in', async (req: Request, res: Response) => {
  const organizationId = req.session.organizationId!;
  const userId = req.session.userId!;

  const existing = await prisma.shift.findFirst({
    where: { organizationId, userId, clockOutAt: null },
  });
  if (existing) {
    res.status(200).json(serializeShift(existing)); // D-01 no-op
    return;
  }

  try {
    const shift = await prisma.shift.create({
      data: { organizationId, userId },
    });
    res.status(201).json(serializeShift(shift));
  } catch (err) {
    // T-07-01: unique constraint on (organizationId, openLock) rejects a concurrent duplicate
    // clock-in that raced past the findFirst check above. Treat it as the D-01 no-op by
    // re-fetching and returning the shift that won the race, instead of a 500.
    if ((err as { code?: string }).code === 'P2002') {
      const winner = await prisma.shift.findFirst({
        where: { organizationId, userId, clockOutAt: null },
      });
      if (winner) {
        res.status(200).json(serializeShift(winner));
        return;
      }
    }
    throw err;
  }
});

// ─── POST /api/shifts/clock-out ───────────────────────────────────────────────
// D-09: requires confirmation on the frontend (ClockOutConfirmDialog) — this endpoint itself
// has no confirmation step, it is called only after the user confirms client-side.
// SECURITY: only the calling user's OWN open shift can be closed — no shiftId in the request
// body, so there is no way to target another moderator's shift via this route.
shiftsRouter.post('/clock-out', async (req: Request, res: Response) => {
  const organizationId = req.session.organizationId!;
  const userId = req.session.userId!;

  const shift = await prisma.shift.findFirst({
    where: { organizationId, userId, clockOutAt: null },
  });
  if (!shift) {
    res.status(404).json({ error: 'NO_ACTIVE_SHIFT' });
    return;
  }

  const updated = await prisma.shift.update({
    where: { id: shift.id },
    data: { clockOutAt: new Date() },
  });
  res.json(serializeShift(updated));
});

// ─── GET /api/shifts/current ──────────────────────────────────────────────────
// D-13: live totals — active-sales count + revenue scoped to the caller's own current shift.
// Returns `null` (not 404) when not clocked in — matches the frontend's
// `useQuery<CurrentShift | null>` contract (UI-SPEC.md §ClockControl).
// Rule 6: revenue computed via Prisma aggregate (Decimal), never JS float / parseFloat.
shiftsRouter.get('/current', async (req: Request, res: Response) => {
  const organizationId = req.session.organizationId!;
  const userId = req.session.userId!;

  const shift = await prisma.shift.findFirst({
    where: { organizationId, userId, clockOutAt: null },
  });
  if (!shift) {
    res.json(null);
    return;
  }

  // prisma.sale.aggregate is NOT intercepted by the softDeleteFilter $extends block
  // (only findMany/findFirst are) — explicit status: 'active' filter required (CLAUDE.md Rule 8).
  const agg = await prisma.sale.aggregate({
    where: { organizationId, shiftId: shift.id, status: 'active' },
    _count: { _all: true },
    _sum: { priceSnapshot: true },
  });

  res.json({
    ...serializeShift(shift),
    activeSalesCount: agg._count._all,
    activeSalesRevenue: (agg._sum.priceSnapshot ?? 0).toFixed(2),
  });
});

// ─── GET /api/shifts/history ───────────────────────────────────────────────────
// D-14: caller's own past shifts (open or closed), newest-first, each with active-sales
// count/revenue (D-04: active-only, voided sales excluded from totals but not from the row
// list rendered elsewhere).
shiftsRouter.get('/history', async (req: Request, res: Response) => {
  const organizationId = req.session.organizationId!;
  const userId = req.session.userId!;

  const shifts = await prisma.shift.findMany({
    where: { organizationId, userId },
    orderBy: { clockInAt: 'desc' },
  });

  if (shifts.length === 0) {
    res.json([]);
    return;
  }

  const shiftIds = shifts.map((s) => s.id);
  // groupBy on a plain column (shiftId) — Decimal SUM computed by Prisma/MySQL, never JS float.
  const aggregates = await prisma.sale.groupBy({
    by: ['shiftId'],
    where: { organizationId, status: 'active', shiftId: { in: shiftIds } },
    _count: { _all: true },
    _sum: { priceSnapshot: true },
  });
  const aggByShiftId = new Map(aggregates.map((a) => [a.shiftId, a]));

  res.json(
    shifts.map((s) => {
      const agg = aggByShiftId.get(s.id);
      return {
        ...serializeShift(s),
        activeSalesCount: agg?._count._all ?? 0,
        activeSalesRevenue: (agg?._sum.priceSnapshot ?? 0).toFixed(2),
      };
    }),
  );
});
