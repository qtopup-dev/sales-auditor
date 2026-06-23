import { Request, Response, NextFunction } from 'express';

// SessionData augmentation — makes req.session.userId and req.session.role type-safe
// MUST be in a file that is imported at startup. requireAuth is imported in app.ts
// which is imported in index.ts — satisfies this requirement.
// CONTEXT.md D-12: requireAuth checks req.session.userId; returns 401 { error: 'UNAUTHORIZED' }
declare module 'express-session' {
  interface SessionData {
    userId: number;
    role: 'admin' | 'moderator';
    username: string;
    organizationId: number;
  }
}

// ROLES-09: backend enforces all access checks. requireAuth is mounted at the router level
// (app.use('/api', requireAuth, protectedRouter)) — NOT per-route. Any route added to
// protectedRouter automatically inherits this check.
// WR-02: also assert organizationId — a session with userId but no organizationId (e.g. from
// an older code version or corrupted store) must be rejected, not silently pass undefined
// to every WHERE clause, which would match zero rows rather than throwing.
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId || !req.session.organizationId) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }
  next();
}
