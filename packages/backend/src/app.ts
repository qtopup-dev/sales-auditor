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
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { productsRouter } from './routes/products.js';
import { mopsRouter } from './routes/mops.js';
import { receiversRouter } from './routes/receivers.js';
import { salesRouter } from './routes/sales.js';
import { catalogRouter } from './routes/catalog.js';
import { adminRouter } from './routes/admin.js';
import { errorHandler } from './middleware/errorHandler.js';

// express-mysql-session requires being called with the session object as argument
// Source: express-mysql-session README — wraps session.Store
const MySQLSessionStore = MySQLStore(session);

export function createApp(): Express {
  // CR-03: Fail fast if SESSION_SECRET is absent — never fall back to a known string.
  // A missing env var must not silently produce a forgeable session cookie.
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET environment variable is required');
  }

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
      secret: sessionSecret,
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
  app.use('/api/auth', authRouter); // AUTH-01 through AUTH-07 (unauthenticated endpoints)

  // Protected routes — requireAuth applied to all; requireRole applied per sub-router
  const protectedRouter = express.Router();
  protectedRouter.use('/users', usersRouter); // admin-only (usersRouter mounts requireRole internally)
  protectedRouter.use('/products', productsRouter); // admin-only (productsRouter mounts requireRole internally)
  protectedRouter.use('/mops', mopsRouter); // admin-only (mopsRouter mounts requireRole internally)
  protectedRouter.use('/receivers', receiversRouter); // admin-only (receiversRouter mounts requireRole internally)
  protectedRouter.use('/sales', salesRouter); // all authenticated users (role checks per-route)
  protectedRouter.use('/catalog', catalogRouter); // all authenticated users (no role restriction — D-05)
  protectedRouter.use('/admin', adminRouter); // admin-only (adminRouter mounts requireRole internally)
  app.use('/api', requireAuth, protectedRouter);

  // 7. Global error handler — MUST be last middleware (Express requires 4-arg signature)
  app.use(errorHandler);

  return app;
}
