// Express 5 app factory
// Middleware registration order is CRITICAL — helmet must be first, errorHandler must be last.
// Do NOT rearrange middleware order in future phases.
import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import session from 'express-session';
import MySQLStore from 'express-mysql-session';

import { sessionPool } from './lib/db.js';
import { requireAuth } from './middleware/requireAuth.js';
import { healthRouter } from './routes/health.js';
import { errorHandler } from './middleware/errorHandler.js';
// Plan 02 will add live imports when route files exist:
// import { authRouter } from './routes/auth.js';
// import { protectedRouter } from './routes/protected.js';

// express-mysql-session requires being called with the session object as argument
// Source: express-mysql-session README — wraps session.Store
const MySQLSessionStore = MySQLStore(session);

export function createApp(): Express {
  const app = express();

  // 1. Security headers — helmet MUST be registered before all routes
  app.use(helmet());

  // 2. CORS — must be before routes so preflight OPTIONS requests get headers
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
      credentials: true, // Required for session cookie to be sent cross-origin
    }),
  );

  // 3. Request logging
  app.use(morgan('dev'));

  // 4. Body parsing
  app.use(express.json());
  // Express 5: extended must be explicit (default changed to false in Express 5)
  app.use(express.urlencoded({ extended: false }));

  // 5. Session store — express-mysql-session with dedicated mysql2 pool
  // sessionPool is imported from lib/db.ts (module-level singleton).
  // This is a SEPARATE connection from the Prisma adapter (which uses mariadb driver).
  // express-mysql-session manages the `sessions` table automatically (createDatabaseTable: true).
  // Never use MemoryStore — it leaks sessions on process restart (STATE.md pitfall).
  const store = new MySQLSessionStore(
    {
      expiration: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
      createDatabaseTable: true, // creates `sessions` table if absent
      clearExpired: true,
      checkExpirationInterval: 900_000, // check every 15 minutes
      connectionLimit: 5,
    },
    sessionPool,
  );

  app.use(
    session({
      secret: process.env.SESSION_SECRET ?? 'change-me-in-production',
      resave: false,
      saveUninitialized: false,
      rolling: true, // Resets cookie expiry on each request
      store,
      cookie: {
        httpOnly: true, // Prevents XSS access to cookie
        secure: process.env.NODE_ENV === 'production', // HTTPS-only in production
        sameSite: 'lax', // CSRF protection
        maxAge: 30 * 24 * 60 * 60 * 1000,
      },
    }),
  );

  // 6. Routes
  app.use('/', healthRouter);
  // Phase 2 route mounts — authRouter and protectedRouter imported in Plan 02
  // when packages/backend/src/routes/auth.ts and routes/protected.ts exist.
  // requireAuth is already imported above (middleware wired here when routes arrive).

  // 7. Global error handler — MUST be last middleware (Express requires 4-arg signature)
  app.use(errorHandler);

  return app;
}
