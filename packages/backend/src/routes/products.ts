import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../middleware/requireRole.js';

export const productsRouter = Router();

// All /api/products/* routes require admin role — ROLES-09, PROD-01 through PROD-04
productsRouter.use(requireRole('admin'));

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

// ─── GET /api/products ───────────────────────────────────────────────────────
// PROD-04: admin views all products (active and inactive)
// Override soft-delete $extends: isActive: { in: [true, false] } wins over default isActive: true
// RESEARCH.md Pitfall 2: explicit isActive key must be in caller's where clause

productsRouter.get('/', async (_req, res) => {
  const products = await prisma.product.findMany({
    where: {
      organizationId: 1,
      isActive: { in: [true, false] }, // override $extends default — show all
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(products.map(serializeProduct));
});

// ─── POST /api/products ──────────────────────────────────────────────────────
// PROD-01: admin creates product with name and price
// Price validation: isDecimal({ decimal_digits: '0,2' }) accepts "10", "10.5", "10.00"
// Prisma accepts decimal string for Decimal fields directly

const productCreateValidation = [
  body('name').trim().notEmpty().withMessage('Product Name is required'),
  body('price')
    .trim()
    .notEmpty().withMessage('Price is required')
    .isDecimal({ decimal_digits: '0,2' }).withMessage('Enter a valid price (e.g., 10.00)'),
];

productsRouter.post('/', productCreateValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
    return;
  }

  const product = await prisma.product.create({
    data: {
      name: req.body.name as string,
      price: req.body.price as string, // Prisma Decimal accepts string
      organizationId: 1,
    },
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

productsRouter.patch('/:id', productUpdateValidation, async (req, res) => {
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
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
      return;
    }

    const id = Number(req.params.id);

    // Fetch current state bypassing $extends default (isActive: { in: [true, false] })
    const current = await prisma.product.findFirst({
      where: { id, organizationId: 1, isActive: { in: [true, false] } },
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
