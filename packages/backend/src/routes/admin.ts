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

  const [totalCount, revenueResult, productBreakdown, mopBreakdown, rawTrend] =
    await Promise.all([
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
  });
});
