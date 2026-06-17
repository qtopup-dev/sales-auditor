// Dedicated mysql2 pool for express-mysql-session session store + direct session queries
// Separate from the Prisma @prisma/adapter-mariadb pool (different drivers, different concerns).
// STATE.md locked decision: express-mysql-session pool separate from Prisma mariadb adapter.
// Used in app.ts (session store setup) and routes/auth.ts (DELETE FROM sessions for password reset).
import 'dotenv/config';
import mysql2 from 'mysql2/promise';

export const sessionPool = mysql2.createPool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
