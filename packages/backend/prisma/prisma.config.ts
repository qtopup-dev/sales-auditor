// Prisma 7: datasource url lives here, NOT in schema.prisma
// Source: https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
