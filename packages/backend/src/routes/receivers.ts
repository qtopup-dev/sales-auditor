import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../middleware/requireRole.js';

export const receiversRouter = Router();

// All /api/receivers/* routes require admin role (same pattern as products and mops)
receiversRouter.use(requireRole('admin'));

// Helper: serialize Prisma Receiver to API shape
function serializeReceiver(r: {
  id: number;
  organizationId: number;
  name: string;
  accountNumber: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: r.id,
    organizationId: r.organizationId,
    name: r.name,
    accountNumber: r.accountNumber,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// ─── GET /api/receivers ───────────────────────────────────────────────────────
// Admin views all receivers (active + inactive)
// isActive: undefined overrides $extends default — shows all records
receiversRouter.get('/', async (req, res) => {
  const receivers = await prisma.receiver.findMany({
    where: {
      organizationId: req.session.organizationId!, // NEVER hardcode 1 (CR-01)
      isActive: undefined, // override $extends default — show all (active + inactive)
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(receivers.map(serializeReceiver));
});

// ─── POST /api/receivers ──────────────────────────────────────────────────────
const receiverCreateValidation = [
  body('name').trim().notEmpty().withMessage('Receiver Name is required').isLength({ max: 255 }).withMessage('Receiver Name must be 255 characters or less'),
  body('accountNumber')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 100 })
    .withMessage('Account Number must be 100 characters or less'),
];

receiversRouter.post('/', receiverCreateValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
    return;
  }
  const rawAccountNumber = req.body.accountNumber as string | null | undefined;
  const receiver = await prisma.receiver.create({
    data: {
      name: (req.body.name as string).trim(),
      accountNumber: rawAccountNumber ? rawAccountNumber.trim() : null,
      organizationId: req.session.organizationId!, // NEVER hardcode 1 (CR-01)
    },
  });
  res.status(201).json(serializeReceiver(receiver));
});

// ─── PATCH /api/receivers/:id ─────────────────────────────────────────────────
const receiverUpdateValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid receiver ID'),
  body('name').trim().notEmpty().withMessage('Receiver Name is required').isLength({ max: 255 }).withMessage('Receiver Name must be 255 characters or less'),
  body('accountNumber')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 100 })
    .withMessage('Account Number must be 100 characters or less'),
];

receiversRouter.patch('/:id', receiverUpdateValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
    return;
  }

  const id = Number(req.params.id);

  // Verify receiver exists and belongs to this org before updating
  const existing = await prisma.receiver.findFirst({
    where: { id, organizationId: req.session.organizationId!, isActive: undefined },
  });
  if (!existing) {
    res.status(404).json({ error: 'RECEIVER_NOT_FOUND' });
    return;
  }

  const rawAccountNumber = req.body.accountNumber as string | null | undefined;
  const receiver = await prisma.receiver.update({
    where: { id, organizationId: req.session.organizationId! },
    data: {
      name: (req.body.name as string).trim(),
      // Only update accountNumber if the field was included in the request body
      ...(req.body.accountNumber !== undefined && {
        accountNumber: rawAccountNumber ? rawAccountNumber.trim() : null,
      }),
    },
  });
  res.json(serializeReceiver(receiver));
});

// ─── PATCH /api/receivers/:id/toggle ─────────────────────────────────────────
// CLAUDE.md Rule 3: NEVER DELETE — only toggle isActive
receiversRouter.patch(
  '/:id/toggle',
  [param('id').isInt({ min: 1 }).withMessage('Invalid receiver ID')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
      return;
    }
    const id = Number(req.params.id);
    // Fetch current state bypassing $extends default (isActive: undefined = no filter)
    const current = await prisma.receiver.findFirst({
      where: { id, organizationId: req.session.organizationId!, isActive: undefined },
      select: { isActive: true },
    });
    if (!current) {
      res.status(404).json({ error: 'RECEIVER_NOT_FOUND' });
      return;
    }
    const receiver = await prisma.receiver.update({
      where: { id, organizationId: req.session.organizationId! },
      data: { isActive: !current.isActive },
    });
    res.json(serializeReceiver(receiver));
  },
);
