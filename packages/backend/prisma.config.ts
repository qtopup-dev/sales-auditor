// Prisma 7: datasource url lives here, NOT in schema.prisma
// Source: https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7
// NOTE: This file must be at the CWD root (packages/backend/) where prisma commands are run
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
