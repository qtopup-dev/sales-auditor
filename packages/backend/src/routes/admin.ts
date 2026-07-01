import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../middleware/requireRole.js';

export const adminRouter = Router();

// All /api/admin/* routes require admin role.
// requireRole is mounted at router level — T-04-01: non-admin session gets 403.
adminRouter.use(requireRole('admin'));

// ─── GET /api/admin/summary ───────────────────────────────────────────────────
// Returns aggregated dashboard stats:
//   totalCount     — number of all sales (active + void) in org
//   totalRevenue   — sum of active sale prices as string "NNN.NN" (CLAUDE.md Rule 6)
//   trendData      — [{date, count}] grouped by DATE(createdAt) via $queryRaw
//   productBreakdown — [{name, count, revenue}] grouped by productNameSnapshot
//   mopBreakdown   — [{name, count}] grouped by mopNameSnapshot
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
      // Count all sales regardless of status (active and voided)
      prisma.sale.count({
        where: { organizationId, status: { in: ['active', 'void'] } },
      }),
      // Revenue only from active sales (voided sales excluded from revenue)
      prisma.sale.aggregate({
        _sum: { priceSnapshot: true },
        where: { organizationId, status: 'active' },
      }),
      // Product breakdown: group by snapshot name (not product ID join — CLAUDE.md Rule 4)
      prisma.sale.groupBy({
        by: ['productNameSnapshot'],
        _count: { _all: true },
        _sum: { priceSnapshot: true },
        where: { organizationId, status: { in: ['active', 'void'] } },
        orderBy: { _count: { productNameSnapshot: 'desc' } },
      }),
      // MOP breakdown: group by snapshot name (not mop ID join — CLAUDE.md Rule 4)
      prisma.sale.groupBy({
        by: ['mopNameSnapshot'],
        _count: { _all: true },
        where: { organizationId, status: { in: ['active', 'void'] } },
        orderBy: { _count: { mopNameSnapshot: 'desc' } },
      }),
      // Trend data: DATE() grouping requires $queryRaw — Prisma groupBy cannot group by expressions
      // BigInt warning: MySQL COUNT(*) returns bigint — must call Number() before JSON serialization
      // Table name: @@map("sales") in schema.prisma — use `sales` (plural lowercase)
      prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE(createdAt) AS date, COUNT(*) AS count
        FROM sales
        WHERE organizationId = ${organizationId}
          AND status IN ('active', 'void')
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

  // toMoneyStr: converts $queryRaw SUM result to "NNN.NN" string.
  // Prisma.Decimal has .toFixed(); mysql2 raw may return string — Number(v).toFixed(2) handles both.
  // Rule 6: never return monetary values as JS float — always string with 2 decimal places.
  const toMoneyStr = (v: unknown): string => {
    if (v == null) return '0.00';
    if (typeof (v as { toFixed?: unknown }).toFixed === 'function') {
      return (v as { toFixed: (n: number) => string }).toFixed(2);
    }
    return Number(v).toFixed(2);
  };

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
