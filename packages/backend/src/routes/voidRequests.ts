import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import type { PrismaTransactionClient } from '../lib/prisma.js';
import { requireRole } from '../middleware/requireRole.js';
import { serializeSale } from './sales.js';

export const voidRequestsRouter = Router();

// voidRequestsRouter does NOT mount requireRole at router level — access is mixed:
// create and pending-sale-ids are moderator-scoped (a moderator acts on their own rows),
// while list/count/approve/reject are admin-scoped (only an admin reviews requests).
// Gates are applied per-route, mirroring the salesRouter precedent, not the fully-gated
// usersRouter precedent.

// ─── Serializers ──────────────────────────────────────────────────────────────

function serializeVoidRequest(vr: {
  id: number;
  organizationId: number;
  saleId: number;
  reason: string;
  status: string;
  requestedById: number;
  requestedByUsername: string;
  reviewedById: number | null;
  reviewedByUsername: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: vr.id,
    organizationId: vr.organizationId,
    saleId: vr.saleId,
    reason: vr.reason,
    status: vr.status,
    requestedById: vr.requestedById,
    requestedByUsername: vr.requestedByUsername,
    reviewedById: vr.reviewedById,
    reviewedByUsername: vr.reviewedByUsername,
    reviewedAt: vr.reviewedAt ? vr.reviewedAt.toISOString() : null,
    createdAt: vr.createdAt.toISOString(),
    updatedAt: vr.updatedAt.toISOString(),
  };
}

function serializeVoidRequestWithSale(vr: {
  id: number;
  organizationId: number;
  saleId: number;
  reason: string;
  status: string;
  requestedById: number;
  requestedByUsername: string;
  reviewedById: number | null;
  reviewedByUsername: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sale: Parameters<typeof serializeSale>[0];
}) {
  return {
    ...serializeVoidRequest(vr),
    sale: serializeSale(vr.sale),
  };
}

// ─── Validation arrays ────────────────────────────────────────────────────────

const createValidation = [
  body('saleId').isInt({ min: 1 }).withMessage('Sale is required'),
  body('reason')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Reason is required')
    .isLength({ max: 2000 })
    .withMessage('Reason must be 2000 characters or fewer'),
];

const reviewValidation = [param('id').isInt({ min: 1 }).withMessage('Invalid request ID')];

// ─── POST /api/void-requests ───────────────────────────────────────────────────
// D-01: moderator only, and only on a sale row they created
// D-02: at most one pending request per sale row (in-transaction guard + DB unique index)
// This handler must not mutate the sale row and must not write an audit record.

voidRequestsRouter.post(
  '/',
  requireRole('moderator'),
  createValidation,
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
      return;
    }

    const { saleId, reason } = req.body as { saleId: number; reason: string };

    try {
      const created = await prisma.$transaction(
        async (tx: PrismaTransactionClient) => {
          // tx does NOT inherit $extends softDeleteFilter — explicit status required
          const sale = await tx.sale.findFirst({
            where: {
              id: Number(saleId),
              organizationId: req.session.organizationId!,
              status: 'active',
            },
          });
          if (!sale) {
            throw Object.assign(new Error('Sale not found'), {
              statusCode: 404,
              code: 'NOT_FOUND',
            });
          }

          // D-01: ownership guard — security-critical, backend-enforced (CLAUDE.md Rule 9)
          if (sale.createdById !== req.session.userId!) {
            throw Object.assign(new Error('Forbidden'), { statusCode: 403, code: 'FORBIDDEN' });
          }

          // D-02: at most one pending request per sale row. Matches status:'pending' only,
          // so a rejected request never permanently blocks a future request (D-03).
          const existingPending = await tx.voidRequest.findFirst({
            where: {
              saleId: sale.id,
              organizationId: req.session.organizationId!,
              status: 'pending',
            },
          });
          if (existingPending) {
            throw Object.assign(new Error('A pending void request already exists for this sale'), {
              statusCode: 409,
              code: 'DUPLICATE_PENDING_REQUEST',
            });
          }

          const createdRequest = await tx.voidRequest.create({
            data: {
              organizationId: req.session.organizationId!,
              saleId: sale.id,
              reason: (reason as string).trim(),
              status: 'pending',
              requestedById: req.session.userId!,
              requestedByUsername: req.session.username!,
            },
          });

          return createdRequest;
        },
        { timeout: 5000, maxWait: 3000 },
      );

      res.status(201).json(serializeVoidRequest(created));
    } catch (err) {
      // T-12-14: race between the findFirst duplicate check and the create — the DB's
      // (organizationId, pendingLock) unique index is the real guard. Translate its P2002
      // to the same 409 contract as the in-transaction guard so both collision paths agree.
      if ((err as { code?: string }).code === 'P2002') {
        res
          .status(409)
          .json({ error: 'DUPLICATE_PENDING_REQUEST', message: 'A pending void request already exists for this sale' });
        return;
      }
      throw err;
    }
  },
);

// ─── GET /api/void-requests ─────────────────────────────────────────────────────
// D-04: admin only; returns every request (pending, approved, rejected) — no status filter.

voidRequestsRouter.get('/', requireRole('admin'), async (req: Request, res: Response) => {
  const requests = await prisma.voidRequest.findMany({
    where: { organizationId: req.session.organizationId! },
    include: { sale: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  res.json(requests.map(serializeVoidRequestWithSale));
});

// ─── GET /api/void-requests/pending-count ────────────────────────────────────────
// D-09: admin only; integer count via Prisma count() — no float arithmetic.

voidRequestsRouter.get(
  '/pending-count',
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const count = await prisma.voidRequest.count({
      where: { organizationId: req.session.organizationId!, status: 'pending' },
    });

    res.json({ count });
  },
);

// ─── GET /api/void-requests/pending-sale-ids ─────────────────────────────────────
// Moderator only; scoped to the caller's own pending requests only — discloses no sale
// IDs the caller did not create.

voidRequestsRouter.get(
  '/pending-sale-ids',
  requireRole('moderator'),
  async (req: Request, res: Response) => {
    const rows = await prisma.voidRequest.findMany({
      where: {
        organizationId: req.session.organizationId!,
        requestedById: req.session.userId!,
        status: 'pending',
      },
      select: { saleId: true },
    });

    res.json({ saleIds: rows.map((r) => r.saleId) });
  },
);

// ─── PATCH /api/void-requests/:id/approve ────────────────────────────────────────
// D-06 / CLAUDE.md Rule 2: voids the sale, writes the AuditLog 'void' entry, and marks
// the request approved — all inside one transaction. Re-reads request as status:'pending'
// and sale as status:'active' so a repeat approve is a 404, not a double-void (T-12-09).

voidRequestsRouter.patch(
  '/:id/approve',
  requireRole('admin'),
  reviewValidation,
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
      return;
    }

    const requestId = Number(req.params.id);

    const result = await prisma.$transaction(
      async (tx: PrismaTransactionClient) => {
        const voidRequest = await tx.voidRequest.findFirst({
          where: {
            id: requestId,
            organizationId: req.session.organizationId!,
            status: 'pending',
          },
        });
        if (!voidRequest) {
          throw Object.assign(new Error('Void request not found'), {
            statusCode: 404,
            code: 'NOT_FOUND',
          });
        }

        const sale = await tx.sale.findFirst({
          where: {
            id: voidRequest.saleId,
            organizationId: req.session.organizationId!,
            status: 'active',
          },
        });
        if (!sale) {
          throw Object.assign(new Error('Sale not found'), { statusCode: 404, code: 'NOT_FOUND' });
        }

        const updatedSale = await tx.sale.update({
          where: { id: sale.id },
          data: {
            status: 'void',
            lastEditedById: req.session.userId!,
            lastEditedByUsername: req.session.username!,
          },
        });

        // CLAUDE.md Rule 2: audit record in the SAME transaction. Reuses the existing
        // 'void' AuditAction value — no new enum value is added.
        await tx.auditLog.create({
          data: {
            organizationId: req.session.organizationId!,
            userId: req.session.userId!,
            userUsername: req.session.username!,
            saleId: sale.id,
            tableName: 'sales',
            rowId: sale.id,
            action: 'void',
            fieldName: null,
            oldValue: 'active',
            newValue: 'void',
          },
        });

        const updatedRequest = await tx.voidRequest.update({
          where: { id: requestId },
          data: {
            status: 'approved',
            reviewedById: req.session.userId!,
            reviewedByUsername: req.session.username!,
            reviewedAt: new Date(),
          },
        });

        return { ...updatedRequest, sale: updatedSale };
      },
      { timeout: 5000, maxWait: 3000 },
    );

    res.json(serializeVoidRequestWithSale(result));
  },
);

// ─── PATCH /api/void-requests/:id/reject ─────────────────────────────────────────
// D-06: updates only the VoidRequest — no sale.update, no auditLog.create. Lookup is
// constrained to status:'pending' so a repeat reject is 404 and never overwrites the
// original reviewer identity/timestamp.

voidRequestsRouter.patch(
  '/:id/reject',
  requireRole('admin'),
  reviewValidation,
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
      return;
    }

    const requestId = Number(req.params.id);

    const result = await prisma.$transaction(
      async (tx: PrismaTransactionClient) => {
        const voidRequest = await tx.voidRequest.findFirst({
          where: {
            id: requestId,
            organizationId: req.session.organizationId!,
            status: 'pending',
          },
        });
        if (!voidRequest) {
          throw Object.assign(new Error('Void request not found'), {
            statusCode: 404,
            code: 'NOT_FOUND',
          });
        }

        const updatedRequest = await tx.voidRequest.update({
          where: { id: requestId },
          data: {
            status: 'rejected',
            reviewedById: req.session.userId!,
            reviewedByUsername: req.session.username!,
            reviewedAt: new Date(),
          },
          include: { sale: true },
        });

        return updatedRequest;
      },
      { timeout: 5000, maxWait: 3000 },
    );

    res.json(serializeVoidRequestWithSale(result));
  },
);
