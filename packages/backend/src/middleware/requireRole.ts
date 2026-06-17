import { Request, Response, NextFunction } from 'express';

// requireRole is a curried middleware factory — call it to produce a middleware.
// CONTEXT.md D-12: returns 403 { error: 'FORBIDDEN' } if session.role !== required role.
// Mount at router level, NOT per-route:
//   adminRouter.use(requireRole('admin'));
//   // all routes on adminRouter automatically require admin role
// ROLES-09: backend enforces all role checks; frontend role checks are UI-only.
export function requireRole(role: 'admin' | 'moderator') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.session.role !== role) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }
    next();
  };
}
