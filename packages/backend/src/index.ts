// Backend entry point
// Import order matters: dotenv/config MUST be first — Prisma 7 does not auto-load .env
import 'dotenv/config';

import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';

// UTC enforcement check — CLAUDE.md Rule 7 (Node process side)
// TZ=UTC is set via cross-env in package.json dev:api script.
// This warning catches cases where the server is started without cross-env.
if (process.env.TZ !== 'UTC') {
  console.warn(
    '[WARNING] process.env.TZ is not "UTC" (current value: %s). ' +
      'All timestamps may be stored in local time. ' +
      'Start the server with: cross-env TZ=UTC tsx --watch src/index.ts',
    process.env.TZ,
  );
}

const PORT = Number(process.env.PORT ?? 3001);

const app = createApp();

async function start() {
  try {
    // Verify Prisma can connect to MySQL before accepting requests
    await prisma.$connect();
    console.log('[prisma] connected to database');

    app.listen(PORT, () => {
      console.log(`[server] listening on http://localhost:${PORT}`);
      console.log(`[server] NODE_ENV=${process.env.NODE_ENV ?? 'development'}`);
      console.log(`[server] TZ=${process.env.TZ ?? '(not set — UTC not guaranteed)'}`);
    });
  } catch (err) {
    console.error('[fatal] startup failed:', err);
    process.exit(1);
  }
}

start();
