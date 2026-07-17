import { Router, Request, Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../middleware/requireRole.js';

export const adminRouter = Router();

// All /api/admin/* routes require admin role.
// requireRole is mounted at router level — T-04-01: non-admin session gets 403.
adminRouter.use(requireRole('admin'));

// toMoneyStr: converts $queryRaw/aggregate SUM results to "NNN.NN" strings.
// Prisma.Decimal has .toFixed(); mysql2 raw may return string — Number(v).toFixed(2) handles both.
// Rule 6: never return monetary values as JS float — always string with 2 decimal places.
// Module-scoped so both /summary and /shifts can reuse it without duplication.
const toMoneyStr = (v: unknown): string => {
  if (v == null) return '0.00';
  if (typeof (v as { toFixed?: unknown }).toFixed === 'function') {
    return (v as { toFixed: (n: number) => string }).toFixed(2);
  }
  return Number(v).toFixed(2);
};

// ─── GET /api/admin/summary ───────────────────────────────────────────────────
// Returns aggregated dashboard stats — all figures are active-only (voided sales excluded):
//   totalCount     — number of active sales in org
//   totalRevenue   — sum of active sale prices as string "NNN.NN" (CLAUDE.md Rule 6)
//   trendData      — [{date, count}] grouped by DATE(createdAt) via $queryRaw, active-only
//   productBreakdown — [{name, count, revenue}] grouped by productNameSnapshot, active-only
//   mopBreakdown   — [{name, count}] grouped by mopNameSnapshot, active-only
//
// NOTE: prisma.sale.count and prisma.sale.aggregate are NOT intercepted by $extends softDeleteFilter
// ($extends only intercepts findMany/findFirst for sale). Add explicit status filter per CLAUDE.md Rule 8.
//
// NOTE: $queryRaw is required for trendData — Prisma groupBy cannot group by a DATE() expression.
// organizationId comes from req.session (server-controlled), not user input — T-04-03 mitigated.

adminRouter.get('/summary', async (req, res) => {
  const organizationId = req.session.organizationId!;

  const [
    totalCount, revenueResult, productBreakdown, mopBreakdown, rawTrend,
    txToday, txYesterday, txThisMonth, txLastMonth,
    sumToday, sumYesterday, sumThisMonth, sumLastMonth,
  ] = await Promise.all([
      // Count active sales only — voided sales must not count toward "Total Sales"
      // (matches totalRevenue/KPI queries below; a voided sale is not a completed sale)
      prisma.sale.count({
        where: { organizationId, status: 'active' },
      }),
      // Revenue only from active sales (voided sales excluded from revenue)
      prisma.sale.aggregate({
        _sum: { priceSnapshot: true },
        where: { organizationId, status: 'active' },
      }),
      // Product breakdown: group by snapshot name (not product ID join — CLAUDE.md Rule 4)
      // Active-only — voided sales must not count toward chart breakdowns
      prisma.sale.groupBy({
        by: ['productNameSnapshot'],
        _count: { _all: true },
        _sum: { priceSnapshot: true },
        where: { organizationId, status: 'active' },
        orderBy: { _count: { productNameSnapshot: 'desc' } },
      }),
      // MOP breakdown: group by snapshot name (not mop ID join — CLAUDE.md Rule 4)
      // Active-only — voided sales must not count toward chart breakdowns
      prisma.sale.groupBy({
        by: ['mopNameSnapshot'],
        _count: { _all: true },
        where: { organizationId, status: 'active' },
        orderBy: { _count: { mopNameSnapshot: 'desc' } },
      }),
      // Trend data: DATE() grouping requires $queryRaw — Prisma groupBy cannot group by expressions
      // BigInt warning: MySQL COUNT(*) returns bigint — must call Number() before JSON serialization
      // Table name: @@map("sales") in schema.prisma — use `sales` (plural lowercase)
      // Active-only — voided sales must not count toward the trend chart
      prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE(createdAt) AS date, COUNT(*) AS count
        FROM sales
        WHERE organizationId = ${organizationId}
          AND status = 'active'
        GROUP BY DATE(createdAt)
        ORDER BY date ASC
      `,
      // ── KPI: Transaction counts (active-only, D-01) ─────────────────────────────
      // BigInt warning: COUNT(*) returns bigint — Number() coercion required before JSON serialization
      // Rule 7: CURDATE() operates in UTC because DB connection is ?timezone=UTC
      // Rule 8: soft-delete middleware does not intercept $queryRaw — explicit status filter required
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) AS count
        FROM sales
        WHERE organizationId = ${organizationId}
          AND status = 'active'
          AND DATE(createdAt) = CURDATE()
      `,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) AS count
        FROM sales
        WHERE organizationId = ${organizationId}
          AND status = 'active'
          AND DATE(createdAt) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
      `,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) AS count
        FROM sales
        WHERE organizationId = ${organizationId}
          AND status = 'active'
          AND YEAR(createdAt) = YEAR(CURDATE())
          AND MONTH(createdAt) = MONTH(CURDATE())
      `,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) AS count
        FROM sales
        WHERE organizationId = ${organizationId}
          AND status = 'active'
          AND YEAR(createdAt) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
          AND MONTH(createdAt) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
      `,
      // ── KPI: Profit (active-only, D-02) + Turnover (active+void, D-03) per period ─
      // Single query per period returns both values via CASE WHEN.
      // profitSum = SUM WHERE active; turnoverSum = SUM WHERE active OR void.
      // SUM returns NULL when no rows match — toMoneyStr handles null → '0.00'.
      // Decimal/string coercion: $queryRaw returns DECIMAL column as Prisma.Decimal or string
      // depending on driver version — toMoneyStr handles both via .toFixed() duck-type check.
      prisma.$queryRaw<[{ profitSum: unknown; turnoverSum: unknown }]>`
        SELECT
          SUM(CASE WHEN status = 'active' THEN priceSnapshot ELSE 0 END) AS profitSum,
          SUM(CASE WHEN status = 'active' THEN priceSnapshot ELSE 0 END) AS turnoverSum
        FROM sales
        WHERE organizationId = ${organizationId}
          AND status IN ('active', 'void')
          AND DATE(createdAt) = CURDATE()
      `,
      prisma.$queryRaw<[{ profitSum: unknown; turnoverSum: unknown }]>`
        SELECT
          SUM(CASE WHEN status = 'active' THEN priceSnapshot ELSE 0 END) AS profitSum,
          SUM(CASE WHEN status = 'active' THEN priceSnapshot ELSE 0 END) AS turnoverSum
        FROM sales
        WHERE organizationId = ${organizationId}
          AND status IN ('active', 'void')
          AND DATE(createdAt) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
      `,
      prisma.$queryRaw<[{ profitSum: unknown; turnoverSum: unknown }]>`
        SELECT
          SUM(CASE WHEN status = 'active' THEN priceSnapshot ELSE 0 END) AS profitSum,
          SUM(CASE WHEN status = 'active' THEN priceSnapshot ELSE 0 END) AS turnoverSum
        FROM sales
        WHERE organizationId = ${organizationId}
          AND status IN ('active', 'void')
          AND YEAR(createdAt) = YEAR(CURDATE())
          AND MONTH(createdAt) = MONTH(CURDATE())
      `,
      prisma.$queryRaw<[{ profitSum: unknown; turnoverSum: unknown }]>`
        SELECT
          SUM(CASE WHEN status = 'active' THEN priceSnapshot ELSE 0 END) AS profitSum,
          SUM(CASE WHEN status = 'active' THEN priceSnapshot ELSE 0 END) AS turnoverSum
        FROM sales
        WHERE organizationId = ${organizationId}
          AND status IN ('active', 'void')
          AND YEAR(createdAt) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
          AND MONTH(createdAt) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
      `,
    ]);

  res.json({
    totalCount,
    // Decimal.toFixed(2) returns string — complies with CLAUDE.md Rule 6 (never return float for money)
    totalRevenue: (revenueResult._sum.priceSnapshot ?? 0).toFixed(2),
    trendData: rawTrend.map((r) => ({
      // DATE(createdAt) may come back as Date object or string depending on MySQL driver
      date: typeof r.date === 'string' ? r.date : (r.date as unknown as Date).toISOString().slice(0, 10),
      // BigInt → number: JSON.stringify cannot serialize BigInt natively
      count: Number(r.count),
    })),
    productBreakdown: productBreakdown.map((r) => ({
      name: r.productNameSnapshot,
      count: r._count._all,
      // Decimal.toFixed(2) — CLAUDE.md Rule 6
      revenue: (r._sum.priceSnapshot ?? 0).toFixed(2),
    })),
    mopBreakdown: mopBreakdown.map((r) => ({
      name: r.mopNameSnapshot,
      count: r._count._all,
    })),
    kpiData: {
      transactions: {
        today:     Number(txToday[0]?.count ?? 0),
        yesterday: Number(txYesterday[0]?.count ?? 0),
        thisMonth: Number(txThisMonth[0]?.count ?? 0),
        lastMonth: Number(txLastMonth[0]?.count ?? 0),
      },
      profit: {
        today:     toMoneyStr(sumToday[0]?.profitSum),
        yesterday: toMoneyStr(sumYesterday[0]?.profitSum),
        thisMonth: toMoneyStr(sumThisMonth[0]?.profitSum),
        lastMonth: toMoneyStr(sumLastMonth[0]?.profitSum),
      },
      turnover: {
        today:     toMoneyStr(sumToday[0]?.turnoverSum),
        yesterday: toMoneyStr(sumYesterday[0]?.turnoverSum),
        thisMonth: toMoneyStr(sumThisMonth[0]?.turnoverSum),
        lastMonth: toMoneyStr(sumLastMonth[0]?.turnoverSum),
      },
    },
  });
});

// ─── GET /api/admin/shifts?date=YYYY-MM-DD ────────────────────────────────────
// D-15: date-scoped admin oversight. One tab per moderator with a shift STARTING that date.
// Multiple shift sessions for the same moderator on the same date are merged into ONE tab
// (D-15) — the tab's `shiftId` is the LATEST session's id (also the force-clock-out target
// if that session is still open; D-01 guarantees at most the most-recent session per day can
// still be open, since a new clock-in is impossible while one is already open).
// D-04: activeSalesCount/activeSalesRevenue are active-only; voided rows still appear in the
// `sales` array (with status) but are excluded from both totals.
// Admin-only via the router-level requireRole('admin') gate (line 9) — read-only (no
// void/edit capability on this route, per D-15).

const shiftsByDateValidation = [
  query('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be YYYY-MM-DD'),
];

// Local, read-only serializer — intentionally NOT imported from sales.ts to keep this route
// independent of that file's plan. Mirrors its .toFixed(2)/.toISOString() conventions exactly.
function serializeSaleForAdminShifts(sale: {
  id: number;
  productNameSnapshot: string;
  priceSnapshot: { toFixed: (n: number) => string };
  mopNameSnapshot: string;
  receiverNameSnapshot: string;
  notes: string | null;
  status: string;
  shiftId: number | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: sale.id,
    productNameSnapshot: sale.productNameSnapshot,
    priceSnapshot: sale.priceSnapshot.toFixed(2),
    mopNameSnapshot: sale.mopNameSnapshot,
    receiverNameSnapshot: sale.receiverNameSnapshot,
    notes: sale.notes,
    status: sale.status,
    shiftId: sale.shiftId,
    createdAt: sale.createdAt.toISOString(),
    updatedAt: sale.updatedAt.toISOString(),
  };
}

adminRouter.get('/shifts', shiftsByDateValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
    return;
  }

  const organizationId = req.session.organizationId!;
  const date = req.query.date as string;

  // NOTE: $queryRaw is required — Prisma cannot filter by DATE(clockInAt) expression directly
  // (same limitation documented at line 22 for trendData). organizationId comes from
  // req.session (server-controlled); date is regex-validated above — both parameterized.
  // clockInAt is stored in UTC (CLAUDE.md Rule 7), but `date` is a Philippines-local calendar
  // date (frontend's phTodayString()/date-picker) — CONVERT_TZ to +08:00 (fixed offset, no
  // DST, doesn't require the mysql.time_zone_name tables to be loaded) before extracting DATE()
  // so a shift that starts between midnight and 8am PH time (still the previous UTC day) is
  // correctly grouped under its PH calendar date, not silently missing from "today".
  const sessions = await prisma.$queryRaw<
    { shiftId: number; userId: number; username: string; clockInAt: Date; clockOutAt: Date | null }[]
  >`
    SELECT s.id AS shiftId, s.userId AS userId, u.username AS username, s.clockInAt AS clockInAt, s.clockOutAt AS clockOutAt
    FROM shifts s
    JOIN users u ON u.id = s.userId
    WHERE s.organizationId = ${organizationId}
      AND DATE(CONVERT_TZ(s.clockInAt, '+00:00', '+08:00')) = ${date}
    ORDER BY s.clockInAt ASC
  `;

  if (sessions.length === 0) {
    res.json({ date, tabs: [] });
    return;
  }

  // Group sessions by userId — D-15 merge: multiple sessions same user/date = one tab.
  // `sessions` is already ORDER BY clockInAt ASC, so the LAST pushed entry per user is the
  // latest session (D-01 guarantees only the latest can still be open).
  const byUser = new Map<number, typeof sessions>();
  for (const s of sessions) {
    const list = byUser.get(s.userId) ?? [];
    list.push(s);
    byUser.set(s.userId, list);
  }

  const allShiftIds = sessions.map((s) => s.shiftId);

  // Single query for ALL sales across every shift session that date — grouped per-user below.
  // status filter includes void (D-04: voided rows still shown, just excluded from totals).
  const allSales = await prisma.sale.findMany({
    where: { organizationId, shiftId: { in: allShiftIds }, status: { in: ['active', 'void'] } },
    orderBy: { createdAt: 'desc' },
  });

  // Per-shift Decimal-safe aggregates (Prisma groupBy on the real shiftId column — MySQL/Prisma
  // performs the SUM, never JS float arithmetic — CLAUDE.md Rule 6).
  const perShiftAgg = await prisma.sale.groupBy({
    by: ['shiftId'],
    where: { organizationId, status: 'active', shiftId: { in: allShiftIds } },
    _count: { _all: true },
    _sum: { priceSnapshot: true },
  });
  const aggByShiftId = new Map(perShiftAgg.map((a) => [a.shiftId, a]));

  const tabs = Array.from(byUser.entries()).map(([userId, userSessions]) => {
    const latest = userSessions[userSessions.length - 1];
    const userShiftIds = new Set(userSessions.map((s) => s.shiftId));
    const userSales = allSales.filter((sale) => sale.shiftId !== null && userShiftIds.has(sale.shiftId));

    // Sum counts/revenue across all of this user's shift sessions that date (usually just one).
    // toMoneyStr (module scope, EDIT 2 above) safely handles the Decimal | number union.
    let activeSalesCount = 0;
    let activeRevenueRaw = 0;
    for (const shiftId of userShiftIds) {
      const agg = aggByShiftId.get(shiftId);
      if (agg) {
        activeSalesCount += agg._count._all;
        activeRevenueRaw += Number(agg._sum.priceSnapshot ?? 0);
      }
    }

    return {
      userId,
      username: latest.username,
      shiftId: latest.shiftId,
      clockOutAt: latest.clockOutAt ? latest.clockOutAt.toISOString() : null,
      activeSalesCount,
      activeSalesRevenue: toMoneyStr(activeRevenueRaw),
      sales: userSales.map(serializeSaleForAdminShifts),
    };
  });

  res.json({ date, tabs });
});

// ─── POST /api/admin/shifts/:id/force-clock-out ───────────────────────────────
// D-16: admin overrides another moderator's still-open shift. Admin-only via the router-level
// requireRole('admin') gate (line 9) — never reachable by a moderator session, including for
// their own shift (moderators use POST /api/shifts/clock-out for that, per Plan 02).
// D-04/D-06: no audit log entry (out of scope per D-06); sales data is completely unaffected —
// only the shift's clockOutAt changes.
adminRouter.post(
  '/shifts/:id/force-clock-out',
  [param('id').isInt({ min: 1 }).withMessage('Invalid shift ID')],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
      return;
    }

    const id = Number(req.params.id);
    const organizationId = req.session.organizationId!;

    const shift = await prisma.shift.findFirst({
      where: { id, organizationId, clockOutAt: null },
    });
    if (!shift) {
      res.status(404).json({ error: 'SHIFT_NOT_FOUND' });
      return;
    }

    const updated = await prisma.shift.update({
      where: { id },
      data: { clockOutAt: new Date() },
    });

    res.json({
      id: updated.id,
      organizationId: updated.organizationId,
      userId: updated.userId,
      clockInAt: updated.clockInAt.toISOString(),
      clockOutAt: updated.clockOutAt!.toISOString(),
    });
  },
);
