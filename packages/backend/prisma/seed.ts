// Minimum seed per D-02: one organization + one admin user
// Idempotent: uses upsert so re-running does not create duplicates
// IMPORTANT: import 'dotenv/config' MUST be first — Prisma 7 does not auto-load .env
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';
import bcrypt from 'bcrypt';

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 1,
  timezone: 'Z',
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // Upsert organization (idempotent)
  const org = await prisma.organization.upsert({
    where: { id: 1 },
    update: {},
    create: { name: 'Default Organization' },
  });
  console.log(`[seed] organization: ${org.name} (id=${org.id})`);

  // Upsert admin user — password: admin1234, cost factor 12 per CLAUDE.md
  // SECURITY NOTE: Change this password immediately after first login in any environment.
  const passwordHash = await bcrypt.hash('admin1234', 12);
  const admin = await prisma.user.upsert({
    where: { organizationId_username: { organizationId: org.id, username: 'admin' } },
    update: {},
    create: {
      organizationId: org.id,
      username: 'admin',
      passwordHash,
      role: 'admin',
      canEdit: true,
      isActive: true,
    },
  });
  console.log(`[seed] admin user: ${admin.username} (id=${admin.id})`);
}

main()
  .catch((e) => {
    console.error('[seed] error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
