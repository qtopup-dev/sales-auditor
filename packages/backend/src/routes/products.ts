import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import type { PrismaTransactionClient } from '../lib/prisma.js';
import { requireRole } from '../middleware/requireRole.js';

export const productsRouter = Router();

// All /api/products/* routes: admin + moderator (Phase 14 D-01). No canEdit (D-04) or shift (D-05) gate.
// requireAuth in app.ts guarantees a live session — ROLES-09
productsRouter.use(requireRole('admin', 'moderator'));

// Helper: serialize a Prisma product to the API shape
// CRITICAL: .toFixed(2) always — never .toNumber() or .toString() (Pitfall 5)
// .toString() drops trailing zeros: Decimal("1000").toString() = "1000" not "1000.00"
function serializeProduct(p: {
  id: number;
  organizationId: number;
  name: string;
  price: { toFixed: (n: number) => string };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    organizationId: p.organizationId,
    name: p.name,
    price: p.price.toFixed(2),
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

// Phase 14 D-06/D-07: every product mutation writes an audit row in the same transaction as the
// change, for admin and moderator alike (no role branch). The products table name is set only here.
function productAudit(
  req: Request,
  rowId: number,
  action: 'create' | 'update',
  fieldName: string | null,
  oldValue: string | null,
  newValue: string | null,
) {
  return {
    organizationId: req.session.organizationId!,
    userId: req.session.userId!,
    userUsername: req.session.username!,
    saleId: null,
    tableName: 'products',
    rowId,
    action,
    fieldName,
    oldValue,
    newValue,
  };
}

// ─── GET /api/products ───────────────────────────────────────────────────────
// PROD-04: admin or moderator (Phase 14) views all products (active and inactive)
// isActive: undefined overrides the $extends default (isActive: true) — Prisma skips undefined
// where conditions, so all records are returned. Boolean fields do not support { in: [...] }.

productsRouter.get('/', async (_req, res) => {
  const products = await prisma.product.findMany({
    where: {
      organizationId: 1,
      isActive: undefined, // override $extends default — show all (active + inactive)
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(products.map(serializeProduct));
});

// ─── POST /api/products ──────────────────────────────────────────────────────
// PROD-01: admin or moderator (Phase 14) creates product with name and price
// Price validation: isDecimal({ decimal_digits: '0,2' }) accepts "10", "10.5", "10.00"
// Prisma accepts decimal string for Decimal fields directly

const productCreateValidation = [
  body('name').trim().notEmpty().withMessage('Product Name is required'),
  body('price')
    .trim()
    .notEmpty().withMessage('Price is required')
    .isDecimal({ decimal_digits: '0,2' }).withMessage('Enter a valid price (e.g., 10.00)'),
];

productsRouter.post('/', productCreateValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
    return;
  }

  // Phase 14 D-06: create + audit row in the same transaction.
  const product = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
    const created = await tx.product.create({
      data: {
        name: req.body.name as string,
        price: req.body.price as string, // Prisma Decimal accepts string
        organizationId: 1,
      },
    });

    await tx.auditLog.create({
      data: productAudit(
        req,
        created.id,
        'create',
        null,
        null,
        JSON.stringify({ name: created.name, price: created.price.toFixed(2) }),
      ),
    });

    return created;
  });

  res.status(201).json(serializeProduct(product));
});

// ─── PATCH /api/products/:id ─────────────────────────────────────────────────
// PROD-02: admin edits product name and/or price
// Accepts: { name?: string, price?: string } — at least one required

const productUpdateValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid product ID'),
  body('name').optional().trim().notEmpty().withMessage('Product Name cannot be empty'),
  body('price')
    .optional()
    .trim()
    .notEmpty().withMessage('Price cannot be empty')
    .isDecimal({ decimal_digits: '0,2' }).withMessage('Enter a valid price (e.g., 10.00)'),
];

productsRouter.patch('/:id', productUpdateValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
    return;
  }

  const id = Number(req.params.id);
  const data: { name?: string; price?: string } = {};
  if (req.body.name !== undefined) data.name = req.body.name as string;
  if (req.body.price !== undefined) data.price = req.body.price as string;

  if (Object.keys(data).length === 0) {
    res
      .status(400)
      .json({ error: 'VALIDATION_ERROR', details: [{ msg: 'At least one field required' }] });
    return;
  }

  const product = await prisma.product.update({
    where: { id, organizationId: 1 },
    data,
  });
  res.json(serializeProduct(product));
});

// ─── PATCH /api/products/:id/toggle ─────────────────────────────────────────
// PROD-03: admin toggles product active/inactive
// Separate endpoint from PATCH /:id to keep semantics clear
// CLAUDE.md Rule 3: NEVER DELETE — only toggle isActive

productsRouter.patch(
  '/:id/toggle',
  [param('id').isInt({ min: 1 }).withMessage('Invalid product ID')],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
      return;
    }

    const id = Number(req.params.id);

    // Fetch current state bypassing $extends default — isActive: undefined = no filter
    const current = await prisma.product.findFirst({
      where: { id, organizationId: 1, isActive: undefined },
      select: { isActive: true },
    });

    if (!current) {
      res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
      return;
    }

    const product = await prisma.product.update({
      where: { id, organizationId: 1 },
      data: { isActive: !current.isActive },
    });
    res.json(serializeProduct(product));
  },
);

// ─── DELETE /api/products/:id ────────────────────────────────────────────────
// CONTEXT.md D-01: sets deletedAt (a second, stricter soft-delete signal distinct from isActive).
// CONTEXT.md D-02: deleted rows are excluded from ALL admin-facing list/catalog queries via the
// $extends softDeleteFilter (Plan 01) — this route does not need to touch any read query itself.
// CONTEXT.md D-03: never touches Sale rows — historical productNameSnapshot/priceSnapshot on
// existing sales rows are completely unaffected.

productsRouter.delete(
  '/:id',
  [param('id').isInt({ min: 1 }).withMessage('Invalid product ID')],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
      return;
    }

    const id = Number(req.params.id);

    // Fetch bypassing the isActive default (undefined = include inactive-but-not-deleted rows too),
    // but KEEP deletedAt: null enforced (not bypassed) — an already-deleted product is treated as
    // not-found, consistent with D-02/D-07 ("once deleted, gone from every admin-facing surface").
    const current = await prisma.product.findFirst({
      where: { id, organizationId: 1, isActive: undefined, deletedAt: null },
      select: { id: true },
    });

    if (!current) {
      res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
      return;
    }

    await prisma.product.update({
      where: { id, organizationId: 1 },
      data: { deletedAt: new Date() },
    });
    res.status(204).send();
  },
);
