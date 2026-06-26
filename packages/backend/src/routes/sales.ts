import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../middleware/requireRole.js';
import type { PrismaTransactionClient } from '../lib/prisma.js';

export const salesRouter = Router();

// salesRouter does NOT mount requireRole at router level — GET / and POST / are open
// to all authenticated users. requireRole('admin') is applied per-route on void and audit.

// ─── Serializers ──────────────────────────────────────────────────────────────

// CRITICAL: priceSnapshot uses .toFixed(2) — never .toString() or .toNumber()
// Decimal("1000").toString() = "1000" not "1000.00" (drops trailing zeros)
function serializeSale(sale: {
  id: number;
  organizationId: number;
  productId: number;
  productNameSnapshot: string;
  priceSnapshot: { toFixed: (n: number) => string };
  mopId: number;
  mopNameSnapshot: string;
  receiverId: number;
  receiverNameSnapshot: string;
  notes: string | null;
  status: string;
  createdById: number;
  createdByUsername: string;
  lastEditedById: number | null;
  lastEditedByUsername: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: sale.id,
    organizationId: sale.organizationId,
    productId: sale.productId,
    productNameSnapshot: sale.productNameSnapshot,
    priceSnapshot: sale.priceSnapshot.toFixed(2),
    mopId: sale.mopId,
    mopNameSnapshot: sale.mopNameSnapshot,
    receiverId: sale.receiverId,
    receiverNameSnapshot: sale.receiverNameSnapshot,
    notes: sale.notes,
    status: sale.status,
    createdById: sale.createdById,
    createdByUsername: sale.createdByUsername,
    lastEditedById: sale.lastEditedById,
    lastEditedByUsername: sale.lastEditedByUsername,
    createdAt: sale.createdAt.toISOString(),
    updatedAt: sale.updatedAt.toISOString(),
  };
}

// AuditLog id is BigInt — must convert to String for JSON serialization
// CRITICAL (CR-02): Number(bigint) silently truncates values above 2^53-1.
// String() is correct for JSON transport; frontend treats id as string.
function serializeAuditEntry(entry: {
  id: bigint;
  organizationId: number;
  userId: number;
  userUsername: string;
  saleId: number | null;
  tableName: string;
  rowId: number;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
}) {
  return {
    id: String(entry.id), // CR-02: was Number(entry.id) — String() prevents BigInt truncation above 2^53
    organizationId: entry.organizationId,
    userId: entry.userId,
    userUsername: entry.userUsername,
    saleId: entry.saleId,
    tableName: entry.tableName,
    rowId: entry.rowId,
    action: entry.action,
    fieldName: entry.fieldName,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    createdAt: entry.createdAt.toISOString(),
  };
}

// ─── Allowed PATCH fields ─────────────────────────────────────────────────────
// SECURITY (T-03-03): allowlist prevents injection of status, organizationId, createdById, etc.

const ALLOWED_PATCH_FIELDS = ['productId', 'mopId', 'receiverId', 'notes'] as const;
type AllowedPatchField = (typeof ALLOWED_PATCH_FIELDS)[number];

// ─── Validation arrays ────────────────────────────────────────────────────────

const createSaleValidation = [
  body('productId').isInt({ min: 1 }).withMessage('Product is required'),
  body('mopId').isInt({ min: 1 }).withMessage('MOP is required'),
  body('receiverId').isInt({ min: 1 }).withMessage('Receiver is required'),
  body('notes').optional().isString(),
];

const patchSaleValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid sale ID'),
  body('field').isIn(ALLOWED_PATCH_FIELDS).withMessage('Invalid field'),
  body('value').exists().withMessage('Value is required'),
  body('value')
    .if(body('field').isIn(['productId', 'mopId', 'receiverId']))
    .isInt({ min: 1 })
    .withMessage('productId, mopId, and receiverId must be positive integers'),
];

const voidSaleValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid sale ID'),
];

// ─── GET /api/sales ───────────────────────────────────────────────────────────
// SALES-01: all rows newest-first
// SALES-15: include voided rows — override $extends default with explicit status key

salesRouter.get('/', async (req, res) => {
  const sales = await prisma.sale.findMany({
    where: {
      organizationId: req.session.organizationId!,
      status: { in: ['active', 'void'] }, // override $extends default — include voided rows (SALES-15)
    },
    orderBy: { createdAt: 'desc' }, // newest-first (SALES-01)
  });
  res.json(sales.map(serializeSale));
});

// ─── POST /api/sales ──────────────────────────────────────────────────────────
// SALES-04: create row (any authenticated user)
// SALES-09: snapshot product name and price at creation (CLAUDE.md Rule 4)
// SALES-14: product, mop, receiver are required
// AUDIT-01/02: audit 'create' record in same Prisma transaction (AUDIT-02 hard constraint)

salesRouter.post('/', createSaleValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
    return;
  }

  const { productId, mopId, receiverId, notes } = req.body as {
    productId: number;
    mopId: number;
    receiverId: number;
    notes?: string;
  };

  const sale = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
    // tx does NOT inherit $extends softDeleteFilter — explicit where clauses required
    const product = await tx.product.findFirst({
      where: {
        id: Number(productId),
        organizationId: req.session.organizationId!,
        isActive: true, // explicit — $extends NOT active in tx
      },
    });
    if (!product) {
      throw Object.assign(new Error('Product not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }

    const mop = await tx.mop.findFirst({
      where: {
        id: Number(mopId),
        organizationId: req.session.organizationId!,
        isActive: true, // explicit — $extends NOT active in tx
      },
    });
    if (!mop) {
      throw Object.assign(new Error('MOP not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }

    const receiver = await tx.receiver.findFirst({
      where: {
        id: Number(receiverId),
        organizationId: req.session.organizationId!,
        isActive: true, // explicit — $extends NOT active in tx
      },
    });
    if (!receiver) {
      throw Object.assign(new Error('Receiver not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }

    // SALES-09 / CLAUDE.md Rule 4: copy name + price to snapshot columns
    const createdSale = await tx.sale.create({
      data: {
        organizationId: req.session.organizationId!,
        productId: Number(productId),
        productNameSnapshot: product.name,
        priceSnapshot: product.price, // Decimal field — Prisma accepts the Decimal value directly
        mopId: Number(mopId),
        mopNameSnapshot: mop.name,
        receiverId: receiver.id,
        receiverNameSnapshot: receiver.name,
        notes: notes ? (notes as string).trim() : null,
        status: 'active',
        createdById: req.session.userId!,
        createdByUsername: req.session.username!,
      },
    });

    // AUDIT-02 hard constraint: audit record in SAME transaction
    await tx.auditLog.create({
      data: {
        organizationId: req.session.organizationId!,
        userId: req.session.userId!,
        userUsername: req.session.username!,
        saleId: createdSale.id,
        tableName: 'sales',
        rowId: createdSale.id,
        action: 'create',
        fieldName: null,
        oldValue: null,
        newValue: null,
      },
    });

    return createdSale;
  }, { timeout: 5000, maxWait: 3000 });

  res.status(201).json(serializeSale(sale));
});

// ─── PATCH /api/sales/:id ─────────────────────────────────────────────────────
// SALES-16: field-level edit (D-09)
// ROLES-03/04/05: owner-with-canEdit OR admin can edit
// AUDIT-01/02: audit 'update' record in same transaction
// D-09: one field per PATCH; productId change also atomically updates snapshots

salesRouter.patch('/:id', patchSaleValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
    return;
  }

  const saleId = Number(req.params.id);
  const field = req.body.field as AllowedPatchField;
  const rawValue = req.body.value as string | number;

  // Fetch canEdit outside transaction — user table is not being mutated here
  const requestingUser = await prisma.user.findFirst({
    where: {
      id: req.session.userId!,
      organizationId: req.session.organizationId!,
      isActive: true,
    },
    select: { canEdit: true },
  });
  if (!requestingUser) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  const updatedSale = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
    // tx does NOT inherit $extends softDeleteFilter — explicit status required
    const sale = await tx.sale.findFirst({
      where: {
        id: saleId,
        organizationId: req.session.organizationId!,
        status: 'active', // explicit — voided rows are not editable
      },
    });
    if (!sale) {
      throw Object.assign(new Error('Sale not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }

    // Any user with canEdit=true (or admin) may edit any active row
    const canMutate = requestingUser.canEdit || req.session.role === 'admin';
    if (!canMutate) {
      throw Object.assign(new Error('Forbidden'), { statusCode: 403, code: 'FORBIDDEN' });
    }

    if (field === 'productId') {
      // Special case: productId change must also refresh name + price snapshots atomically
      const newProduct = await tx.product.findFirst({
        where: {
          id: Number(rawValue),
          organizationId: req.session.organizationId!,
          isActive: true, // explicit
        },
      });
      if (!newProduct) {
        throw Object.assign(new Error('Product not found'), { statusCode: 404, code: 'NOT_FOUND' });
      }

      // Capture old values for audit — from Prisma result BEFORE update (T-03-08)
      const oldProductId = String(sale.productId);
      const oldProductName = sale.productNameSnapshot;
      const oldPrice = sale.priceSnapshot.toFixed(2);

      const updated = await tx.sale.update({
        where: { id: saleId },
        data: {
          productId: newProduct.id,
          productNameSnapshot: newProduct.name,
          priceSnapshot: newProduct.price,
          lastEditedById: req.session.userId!,
          lastEditedByUsername: req.session.username!,
        },
      });

      // Three audit entries for productId change: productId, productNameSnapshot, priceSnapshot
      await tx.auditLog.createMany({
        data: [
          {
            organizationId: req.session.organizationId!,
            userId: req.session.userId!,
            userUsername: req.session.username!,
            saleId,
            tableName: 'sales',
            rowId: saleId,
            action: 'update',
            fieldName: 'productId',
            oldValue: oldProductId,
            newValue: String(updated.productId),
          },
          {
            organizationId: req.session.organizationId!,
            userId: req.session.userId!,
            userUsername: req.session.username!,
            saleId,
            tableName: 'sales',
            rowId: saleId,
            action: 'update',
            fieldName: 'productNameSnapshot',
            oldValue: oldProductName,
            newValue: updated.productNameSnapshot,
          },
          {
            organizationId: req.session.organizationId!,
            userId: req.session.userId!,
            userUsername: req.session.username!,
            saleId,
            tableName: 'sales',
            rowId: saleId,
            action: 'update',
            fieldName: 'priceSnapshot',
            oldValue: oldPrice,
            newValue: updated.priceSnapshot.toFixed(2),
          },
        ],
      });

      return updated;
    } else if (field === 'mopId') {
      // Special case: mopId change must also refresh mopNameSnapshot atomically
      // Mirror the productId special-case above (CR-01 fix)
      const newMop = await tx.mop.findFirst({
        where: {
          id: Number(rawValue),
          organizationId: req.session.organizationId!,
          isActive: true, // explicit — $extends NOT active in tx
        },
      });
      if (!newMop) {
        throw Object.assign(new Error('MOP not found'), { statusCode: 404, code: 'NOT_FOUND' });
      }

      // Capture old values for audit — from Prisma result BEFORE update (T-03-08)
      const oldMopId = String(sale.mopId);
      const oldMopName = sale.mopNameSnapshot;

      const updated = await tx.sale.update({
        where: { id: saleId },
        data: {
          mopId: newMop.id,
          mopNameSnapshot: newMop.name,
          lastEditedById: req.session.userId!,
          lastEditedByUsername: req.session.username!,
        },
      });

      // Two audit entries for mopId change: mopId and mopNameSnapshot
      await tx.auditLog.createMany({
        data: [
          {
            organizationId: req.session.organizationId!,
            userId: req.session.userId!,
            userUsername: req.session.username!,
            saleId,
            tableName: 'sales',
            rowId: saleId,
            action: 'update',
            fieldName: 'mopId',
            oldValue: oldMopId,
            newValue: String(updated.mopId),
          },
          {
            organizationId: req.session.organizationId!,
            userId: req.session.userId!,
            userUsername: req.session.username!,
            saleId,
            tableName: 'sales',
            rowId: saleId,
            action: 'update',
            fieldName: 'mopNameSnapshot',
            oldValue: oldMopName,
            newValue: updated.mopNameSnapshot,
          },
        ],
      });

      return updated;
    } else if (field === 'receiverId') {
      // Special case: receiverId change must also refresh receiverNameSnapshot atomically
      // Mirror the mopId special-case above (same pattern for FK + snapshot + 2 audit entries)
      const newReceiver = await tx.receiver.findFirst({
        where: {
          id: Number(rawValue),
          organizationId: req.session.organizationId!,
          isActive: true, // explicit — $extends NOT active in tx
        },
      });
      if (!newReceiver) {
        throw Object.assign(new Error('Receiver not found'), { statusCode: 404, code: 'NOT_FOUND' });
      }

      // Capture old values for audit — from Prisma result BEFORE update
      const oldReceiverId = String(sale.receiverId);
      const oldReceiverName = sale.receiverNameSnapshot;

      const updated = await tx.sale.update({
        where: { id: saleId },
        data: {
          receiverId: newReceiver.id,
          receiverNameSnapshot: newReceiver.name,
          lastEditedById: req.session.userId!,
          lastEditedByUsername: req.session.username!,
        },
      });

      // Two audit entries for receiverId change: receiverId + receiverNameSnapshot
      await tx.auditLog.createMany({
        data: [
          {
            organizationId: req.session.organizationId!,
            userId: req.session.userId!,
            userUsername: req.session.username!,
            saleId,
            tableName: 'sales',
            rowId: saleId,
            action: 'update',
            fieldName: 'receiverId',
            oldValue: oldReceiverId,
            newValue: String(updated.receiverId),
          },
          {
            organizationId: req.session.organizationId!,
            userId: req.session.userId!,
            userUsername: req.session.username!,
            saleId,
            tableName: 'sales',
            rowId: saleId,
            action: 'update',
            fieldName: 'receiverNameSnapshot',
            oldValue: oldReceiverName,
            newValue: updated.receiverNameSnapshot,
          },
        ],
      });

      return updated;
    } else {
      // Standard field update: notes only
      // notes — coerce to string; notes can be null/empty
      const coercedValue: string | null =
        field === 'notes' && rawValue === '' ? null : String(rawValue);

      // Capture old value from DB result BEFORE update (T-03-08: prevents audit forgery)
      const oldValue = String(sale[field as keyof typeof sale] ?? '');

      const updated = await tx.sale.update({
        where: { id: saleId },
        data: {
          [field]: coercedValue,
          lastEditedById: req.session.userId!,
          lastEditedByUsername: req.session.username!,
        },
      });

      // newValue from Prisma return — NOT from req.body.value (T-03-08)
      const newValue = String(updated[field as keyof typeof updated] ?? '');

      await tx.auditLog.create({
        data: {
          organizationId: req.session.organizationId!,
          userId: req.session.userId!,
          userUsername: req.session.username!,
          saleId,
          tableName: 'sales',
          rowId: saleId,
          action: 'update',
          fieldName: field,
          oldValue,
          newValue,
        },
      });

      return updated;
    }
  }, { timeout: 5000, maxWait: 3000 });

  res.json(serializeSale(updatedSale));
});

// ─── POST /api/sales/:id/void ─────────────────────────────────────────────────
// ROLES-06 (T-03-04): admin only — requireRole('admin') returns 403 before handler for moderators
// AUDIT-01/02: audit 'void' record in same transaction

salesRouter.post(
  '/:id/void',
  requireRole('admin'),
  voidSaleValidation,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
      return;
    }

    const saleId = Number(req.params.id);

    const updatedSale = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      // tx does NOT inherit $extends — explicit status required
      const sale = await tx.sale.findFirst({
        where: {
          id: saleId,
          organizationId: req.session.organizationId!,
          status: 'active', // can only void active rows
        },
      });


      if (!sale) {
        throw Object.assign(new Error('Sale not found'), { statusCode: 404, code: 'NOT_FOUND' });
      }

      const updated = await tx.sale.update({
        where: { id: saleId, organizationId: req.session.organizationId! },
        data: {
          status: 'void',
          lastEditedById: req.session.userId!,
          lastEditedByUsername: req.session.username!,
        },
      });

      // AUDIT-02: audit record in same transaction
      await tx.auditLog.create({
        data: {
          organizationId: req.session.organizationId!,
          userId: req.session.userId!,
          userUsername: req.session.username!,
          saleId,
          tableName: 'sales',
          rowId: saleId,
          action: 'void',
          fieldName: null,
          oldValue: 'active',
          newValue: 'void',
        },
      });

      return updated;
    }, { timeout: 5000, maxWait: 3000 });

    res.json(serializeSale(updatedSale));
  },
);

// ─── GET /api/sales/:id/audit ─────────────────────────────────────────────────
// AUDIT-03: per-row audit history, newest-first
// D-14 (T-03-06): admin only — requireRole('admin') returns 403 before handler for moderators

salesRouter.get(
  '/:id/audit',
  requireRole('admin'),
  param('id').isInt({ min: 1 }).withMessage('Invalid sale ID'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
      return;
    }

    const saleId = Number(req.params.id);

    const entries = await prisma.auditLog.findMany({
      where: {
        saleId,
        organizationId: req.session.organizationId!,
      },
      orderBy: { createdAt: 'desc' }, // newest-first (AUDIT-03)
    });

    res.json(entries.map(serializeAuditEntry));
  },
);
