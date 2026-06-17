// PrismaClient singleton with soft-delete $extends query extension
// Prisma 7: uses $extends (NOT $use — $use was removed in Prisma 7)
// Driver: @prisma/adapter-mariadb — separate connection pool from express-mysql-session
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../generated/prisma/index.js';

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
  timezone: 'Z', // 'Z' = UTC — satisfies CLAUDE.md Rule 7 at the driver level
});

const baseClient = new PrismaClient({ adapter });

// Soft-delete filter extension — CLAUDE.md Rules 3 and 8
// Override pattern for admin queries that need voided records:
//   prisma.sale.findMany({ where: { status: { in: ['active', 'void'] }, organizationId } })
export const prisma = baseClient.$extends({
  name: 'softDeleteFilter',
  query: {
    // Sales: inject status='active' as default; caller can override with explicit status
    sale: {
      findMany({ args, query }) {
        args.where = { status: 'active', ...args.where };
        return query(args);
      },
      findFirst({ args, query }) {
        args.where = { status: 'active', ...args.where };
        return query(args);
      },
    },
    // Users: inject isActive=true as default
    user: {
      findMany({ args, query }) {
        args.where = { isActive: true, ...args.where };
        return query(args);
      },
    },
    // Products: inject isActive=true as default
    product: {
      findMany({ args, query }) {
        args.where = { isActive: true, ...args.where };
        return query(args);
      },
    },
    // Mops: inject isActive=true as default
    mop: {
      findMany({ args, query }) {
        args.where = { isActive: true, ...args.where };
        return query(args);
      },
    },
  },
});

// Transaction client type — used in Phase 3 for audit log writes in same transaction
export type PrismaTransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];
