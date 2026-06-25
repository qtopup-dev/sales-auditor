import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../middleware/requireRole.js';

export const mopsRouter = Router();

// All /api/mops/* routes require admin role — ROLES-09, PAY-01 through PAY-04
mopsRouter.use(requireRole('admin'));

// Helper: serialize a Prisma mop to the API shape
function serializeMop(m: {
  id: number;
  organizationId: number;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: m.id,
    organizationId: m.organizationId,
    name: m.name,
    isActive: m.isActive,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

// ─── GET /api/mops ───────────────────────────────────────────────────────────
// PAY-04: admin views all MOPs (active and inactive)
// isActive: undefined overrides the $extends default — Boolean fields do not support { in: [...] }.

mopsRouter.get('/', async (_req, res) => {
  const mops = await prisma.mop.findMany({
    where: {
      organizationId: 1,
      isActive: undefined, // override $extends default — show all (active + inactive)
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(mops.map(serializeMop));
});

// ─── POST /api/mops ──────────────────────────────────────────────────────────
// PAY-01: admin creates MOP with name

mopsRouter.post(
  '/',
  [body('name').trim().notEmpty().withMessage('Payment Method Name is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
      return;
    }
    const mop = await prisma.mop.create({
      data: { name: req.body.name as string, organizationId: 1 },
    });
    res.status(201).json(serializeMop(mop));
  },
);

// ─── PATCH /api/mops/:id ─────────────────────────────────────────────────────
// PAY-02: admin edits MOP name

mopsRouter.patch(
  '/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid MOP ID'),
    body('name').trim().notEmpty().withMessage('Payment Method Name is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
      return;
    }
    const mop = await prisma.mop.update({
      where: { id: Number(req.params.id), organizationId: 1 },
      data: { name: req.body.name as string },
    });
    res.json(serializeMop(mop));
  },
);

// ─── PATCH /api/mops/:id/toggle ──────────────────────────────────────────────
// PAY-03: admin toggles MOP active/inactive
// CLAUDE.md Rule 3: NEVER DELETE — only toggle isActive

mopsRouter.patch(
  '/:id/toggle',
  [param('id').isInt({ min: 1 }).withMessage('Invalid MOP ID')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
      return;
    }

    const id = Number(req.params.id);

    // Fetch current state bypassing $extends default — isActive: undefined = no filter
    const current = await prisma.mop.findFirst({
      where: { id, organizationId: 1, isActive: undefined },
      select: { isActive: true },
    });

    if (!current) {
      res.status(404).json({ error: 'MOP_NOT_FOUND' });
      return;
    }

    const mop = await prisma.mop.update({
      where: { id, organizationId: 1 },
      data: { isActive: !current.isActive },
    });
    res.json(serializeMop(mop));
  },
);
