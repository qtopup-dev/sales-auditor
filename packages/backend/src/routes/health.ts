import { Router, Request, Response } from 'express';

export const healthRouter = Router();

// GET /health — returns server status and UTC timestamp
// This is the only API endpoint delivered in Phase 1.
// Phase 2 attaches auth routes to the Express app in app.ts.
healthRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(), // UTC ISO string — TZ=UTC set in index.ts
  });
});
