import { Request, Response, NextFunction } from 'express';

// requireRole is a curried middleware factory — call it to produce a middleware.
// Accepts one or more roles; the request passes if the session role is any of them.
// CONTEXT.md D-12: returns 403 { error: 'FORBIDDEN' } if session.role is not one of the given roles.
// Mount at router level, NOT per-route:
//   adminRouter.use(requireRole('admin'));
//   productsRouter.use(requireRole('admin', 'moderator'));
//   // all routes on the router automatically require one of the given roles
// ROLES-09: backend enforces all role checks; frontend role checks are UI-only.
export function requireRole(...roles: Array<'admin' | 'moderator'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.session.role;
    if (!role || !roles.includes(role)) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }
    next();
  };
}
