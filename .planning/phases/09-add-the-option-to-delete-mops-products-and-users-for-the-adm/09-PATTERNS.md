# Phase 9: Add the option to delete MOPs, Products, and Users for the admin - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 12 (3 schema model edits + 1 shared middleware + 3 route files + 3 page files + 3 new dialog components)
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `packages/backend/prisma/schema.prisma` (Product/Mop/User models — add `deletedAt`) | model | CRUD | same file, `isActive` field declarations | exact (same file, add sibling field) |
| `packages/backend/src/lib/prisma.ts` ($extends softDeleteFilter — extend to `deletedAt: null`) | middleware | CRUD | same file, existing `isActive: true` injections | exact (same file, add clause) |
| `packages/backend/src/routes/products.ts` (new `DELETE /api/products/:id` or similar) | route/controller | request-response (destructive CRUD) | `PATCH /api/products/:id/toggle` in same file (lines 125-154) | exact |
| `packages/backend/src/routes/mops.ts` (new delete route) | route/controller | request-response (destructive CRUD) | `PATCH /api/mops/:id/toggle` in same file (lines 91-120) | exact |
| `packages/backend/src/routes/users.ts` (new delete route with self/last-admin/session-kill safeguards) | route/controller | request-response (destructive CRUD + session invalidation) | `POST /:id/reset-password` in same file (lines 157-199) for session-kill; `auth.ts` `/change-password` (lines 236-265) for safeguard/error-throw shape | exact |
| `packages/frontend/src/pages/ProductsPage.tsx` (add Delete button + dialog wiring) | component/page | request-response | same file — existing toggle button + `pendingToggleId` pattern (lines 68-100) | exact |
| `packages/frontend/src/pages/MopsPage.tsx` (add Delete button + dialog wiring) | component/page | request-response | same file — mirrors ProductsPage (lines 56-89) | exact |
| `packages/frontend/src/pages/UsersPage.tsx` (add Delete button + dialog wiring) | component/page | request-response | same file — Actions column pattern (lines 154-216) | exact |
| `packages/frontend/src/components/catalog/ProductDeleteConfirmDialog.tsx` (new) | component | request-response | `VoidConfirmDialog.tsx` (structure) + `ProductModal.tsx` (props-based, non-Zustand target pattern) | role-match (hybrid of two analogs, per UI-SPEC explicit instruction) |
| `packages/frontend/src/components/catalog/MopDeleteConfirmDialog.tsx` (new) | component | request-response | same as above | role-match |
| `packages/frontend/src/components/users/UserDeleteConfirmDialog.tsx` (new) | component | request-response | `VoidConfirmDialog.tsx` (structure) + `InviteRegisterPage.tsx` (error-code-to-message mapping, lines 47-54) | role-match |

## Pattern Assignments

### `packages/backend/prisma/schema.prisma` (model, CRUD)

**Analog:** same file — `Product`, `Mop`, `User` models (lines 51-102)

Add a nullable `deletedAt` field as a sibling to `isActive`, same style/placement (right after `isActive`, before `createdAt`):

```prisma
// Product model, lines 73-87 today
model Product {
  id             Int          @id @default(autoincrement())
  organizationId Int
  organization   Organization @relation(fields: [organizationId], references: [id])
  name           String       @db.VarChar(255)
  price          Decimal      @db.Decimal(10, 2)
  isActive       Boolean      @default(true)
  deletedAt      DateTime?    // D-01: second soft-delete signal, distinct from isActive
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  sales Sale[]

  @@index([organizationId, isActive])
  @@map("products")
}
```

Same shape for `Mop` (lines 89-102) and `User` (lines 51-71) — add `deletedAt DateTime?` directly under `isActive`. No new `@@index` strictly required by CONTEXT.md, but consider `@@index([organizationId, deletedAt])` mirroring the existing `@@index([organizationId, isActive])` convention if list-query performance matters (discretionary).

**Migration workflow note:** STATE.md documents that Phases 5 and 7 required the manual `db execute` + `migrate resolve` workaround due to sessions-table drift blocking `prisma migrate dev`. Check whether this is still needed before running `prisma migrate dev` for this `deletedAt` migration (per CONTEXT.md discretion item).

---

### `packages/backend/src/lib/prisma.ts` (middleware, CRUD — shared soft-delete filter)

**Analog:** same file, lines 24-67 (existing `$extends` block)

Extend each `findMany` (and add `findFirst` where relevant) to also inject `deletedAt: null` alongside the existing `isActive: true`:

```typescript
// lines 38-58 today — extend each entity's default where-injection
user: {
  findMany({ args, query }) {
    args.where = { isActive: true, deletedAt: null, ...args.where };
    return query(args);
  },
},
product: {
  findMany({ args, query }) {
    args.where = { isActive: true, deletedAt: null, ...args.where };
    return query(args);
  },
},
mop: {
  findMany({ args, query }) {
    args.where = { isActive: true, deletedAt: null, ...args.where };
    return query(args);
  },
},
```

**Critical nuance (D-02 vs. existing `isActive: undefined` override pattern):** Today, `products.ts`/`mops.ts`/`users.ts` GET-all routes override the `isActive: true` default with `isActive: undefined` to show BOTH active and inactive rows in the admin table (see `products.ts` lines 39-48, `mops.ts` lines 34-43, `users.ts` lines 20-39). D-02 requires `deletedAt: null` to apply **unconditionally with no override** — so when adding `deletedAt: null` to the `$extends` default, the GET-all routes must NOT also override it with `deletedAt: undefined`. Only `isActive: undefined` should be spread in those routes' `where` clauses; `deletedAt: null` must remain enforced (either by leaving it out of the route's own `where` object so the extension's default wins, or by not spreading `deletedAt: undefined`).

---

### `packages/backend/src/routes/products.ts` (route, request-response destructive)

**Analog:** same file, `PATCH /api/products/:id/toggle` (lines 125-154)

**Imports** (lines 1-4) — already present, no new imports needed:
```typescript
import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../middleware/requireRole.js';
```

**Auth pattern** (line 9) — router-level guard already covers new route, no per-route addition needed:
```typescript
productsRouter.use(requireRole('admin'));
```

**Core delete pattern** (model on toggle route, lines 125-154) — validate id, fetch bypassing default filter (`isActive: undefined` today; will need `deletedAt: undefined` too if a not-yet-deleted check is desired before delete), 404 if missing, then set `deletedAt: new Date()`:

```typescript
// New: DELETE /api/products/:id (or POST /:id/delete — pick per CONTEXT.md discretion,
// but note existing convention favors PATCH .../toggle style verbs for state-changing actions)
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

    const current = await prisma.product.findFirst({
      where: { id, organizationId: 1, isActive: undefined, deletedAt: undefined },
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
```

**Error handling pattern:** Same as existing routes — `express-validator` → 400, missing row → 404, no try/catch (Express 5 forwards thrown/async errors to `errorHandler.ts` automatically per its header comment).

---

### `packages/backend/src/routes/mops.ts` (route, request-response destructive)

**Analog:** same file, `PATCH /api/mops/:id/toggle` (lines 91-120)

Identical shape to products.ts above — same imports, same `mopsRouter.use(requireRole('admin'))` guard (line 9), same validate → findFirst-bypass-filter → 404-or-update(`deletedAt: new Date()`) shape. Copy the toggle handler's structure verbatim and swap the update payload from `{ isActive: !current.isActive }` to `{ deletedAt: new Date() }`, and drop the `current.isActive` read (delete doesn't need prior state, just existence).

---

### `packages/backend/src/routes/users.ts` (route, request-response destructive + session-kill)

**Analog A — session-kill:** same file, `POST /:id/reset-password` (lines 150-199)

**Analog B — safeguard error-throw shape:** `packages/backend/src/routes/auth.ts`, `invite/:token` POST handler transaction error-throw (lines 203-208), and `errorHandler.ts` (reads `err.statusCode` + `err.code`, lines 14-15)

**Imports** (lines 1-7) — already present:
```typescript
import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { sessionPool } from '../lib/db.js';
import { requireRole } from '../middleware/requireRole.js';
```

**Core delete pattern** — combines existence check + D-08 self-delete + D-09 last-admin + delete + D-10 session-kill:

```typescript
// New: DELETE /api/users/:id (route naming per CONTEXT.md discretion)
usersRouter.delete(
  '/:id',
  [param('id').isInt({ min: 1 }).withMessage('Invalid user ID')],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
      return;
    }

    const targetId = Number(req.params.id);
    const organizationId = req.session.organizationId!;

    // D-08: block self-delete
    if (targetId === req.session.userId) {
      res.status(400).json({ error: 'CANNOT_DELETE_SELF' });
      return;
    }

    const target = await prisma.user.findFirst({
      where: { id: targetId, organizationId, isActive: undefined, deletedAt: undefined },
      select: { id: true, role: true },
    });
    if (!target) {
      res.status(404).json({ error: 'USER_NOT_FOUND' });
      return;
    }

    // D-09: block deleting the last remaining admin
    if (target.role === 'admin') {
      const otherAdminCount = await prisma.user.count({
        where: { organizationId, role: 'admin', deletedAt: null, NOT: { id: targetId } },
      });
      if (otherAdminCount === 0) {
        res.status(400).json({ error: 'LAST_ADMIN' });
        return;
      }
    }

    await prisma.user.update({
      where: { id: targetId, organizationId },
      data: { deletedAt: new Date() },
    });

    // D-10: kill ALL sessions for this user — verbatim pattern from reset-password (lines 192-195),
    // no session-id exclusion (unlike auth.ts change-password's self-preserving variant)
    await sessionPool.query(
      `DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ?`,
      [targetId],
    );

    res.status(204).send();
  },
);
```

**Login-block pattern (D-10, second half):** `auth.ts` `POST /login` (lines 55-57) already does `findFirst({ where: { username, isActive: true, organizationId: 1 } })` — this already excludes any row where `isActive` was flipped false, but does NOT check `deletedAt`. Add `deletedAt: null` to that where clause:
```typescript
// auth.ts line 55-57 today — extend to also reject deleted users
const user = await prisma.user.findFirst({
  where: { username, isActive: true, deletedAt: null, organizationId: 1 },
});
```

---

### `packages/frontend/src/pages/ProductsPage.tsx` (page, request-response)

**Analog:** same file — `pendingToggleId` state + toggle mutation + Actions cell (lines 22-24, 31-42, 67-100)

**State pattern to add** (mirrors line 24's `pendingToggleId`):
```typescript
const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
```

**Actions column addition** (after line 95's closing `</button>` for Deactivate/Activate, inside the same `<div className="flex items-center gap-1">`) — exact markup given in UI-SPEC.md §Actions column changes:
```tsx
<span className="text-gray-300 dark:text-gray-600 mx-1">|</span>
<button
  type="button"
  disabled={isThisTogglePending}
  onClick={() => setDeleteTarget(product)}
  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm disabled:text-gray-400 disabled:cursor-not-allowed"
>
  Delete
</button>
```

**Dialog mount point** (mirrors `ProductModal` mount at lines 177-182):
```tsx
{deleteTarget && (
  <ProductDeleteConfirmDialog product={deleteTarget} onClose={() => setDeleteTarget(null)} />
)}
```

No new import beyond `ProductDeleteConfirmDialog` from `../components/catalog/ProductDeleteConfirmDialog`.

---

### `packages/frontend/src/pages/MopsPage.tsx` (page, request-response)

**Analog:** same file — identical structure to ProductsPage.tsx (lines 20-22, 29-40, 56-90). Apply the same `deleteTarget` state + Actions-column button + dialog-mount changes, swapping `Product`→`Mop`, `product`→`mop`, `ProductDeleteConfirmDialog`→`MopDeleteConfirmDialog`.

---

### `packages/frontend/src/pages/UsersPage.tsx` (page, request-response)

**Analog:** same file — Actions column (lines 154-216), `pendingCanEditId`/`pendingResetId` state pattern (lines 52-53)

**State pattern to add:**
```typescript
const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
```

**Actions column addition** — after the Reset Password button (after line 212's closing `</button>`), with the same `|` separator convention, red styling, and the UI-SPEC own-row disable recommendation:
```tsx
<span className="text-gray-300 dark:text-gray-600 mx-1">|</span>
<button
  type="button"
  disabled={isRowPending || user.id === useAuthStore.getState().user?.id}
  onClick={() => setDeleteTarget(user)}
  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm disabled:text-gray-400 disabled:cursor-not-allowed"
>
  Delete
</button>
```
Note: extend `isRowPending` (line 160) to also check a new delete-in-flight indicator if the dialog itself doesn't already disable the row visually — the UI-SPEC only requires the dialog's own buttons to show pending state; row-disable-during-delete-dialog-open is an additive nicety, not a hard requirement.

Import needed: `useAuthStore` from `../stores/authStore` (see `getAuthUser`/`useAuthStore.getState().user` pattern, `authStore.ts` lines 18-25) and `UserDeleteConfirmDialog` from `../components/users/UserDeleteConfirmDialog`.

**Dialog mount point** (mirrors `UserModal`/`ResetPasswordModal` mounts at lines 289-306):
```tsx
<UserDeleteConfirmDialog user={deleteTarget} onClose={() => setDeleteTarget(null)} />
```

---

### `packages/frontend/src/components/catalog/ProductDeleteConfirmDialog.tsx` (new component, request-response)

**Analog A (dialog structure/pending-state/footer):** `packages/frontend/src/components/sales/VoidConfirmDialog.tsx` (full file, 60 lines)
**Analog B (props-based target instead of Zustand):** `packages/frontend/src/components/catalog/ProductModal.tsx` (props interface, lines 8-11)

Per UI-SPEC.md §Component & Interaction Contract: build like `VoidConfirmDialog` but take `product`/`onClose` as **props**, not Zustand store state (Zustand is only used there because `VoidConfirmDialog` is triggered from inside a virtualized table row — not the case here).

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../Modal';
import { api } from '../../lib/axios';
import type { Product } from '@alejinput/shared';

interface ProductDeleteConfirmDialogProps {
  product: Product | null;
  onClose: () => void;
}

export function ProductDeleteConfirmDialog({ product, onClose }: ProductDeleteConfirmDialogProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (productId: number) => api.delete(`/products/${productId}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
  });

  const isPending = deleteMutation.isPending;

  return (
    <Modal
      open={product !== null}
      onClose={isPending ? undefined : onClose}
      title="Delete Product"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-sm font-normal hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => product && deleteMutation.mutate(product.id)}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-normal hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Deleting...' : 'Delete Product'}
          </button>
        </>
      }
    >
      <p className="text-sm font-normal text-gray-900 dark:text-gray-100">
        Are you sure you want to delete this product? This cannot be undone.
      </p>
      {deleteMutation.isError && (
        <p className="text-sm font-normal text-red-600 dark:text-red-400 mt-2">
          Failed to delete product. Please try again.
        </p>
      )}
    </Modal>
  );
}
```

Note the `open={product !== null}` pattern (adapted from `ProductModal`'s `open` always-true-when-mounted convention, combined with `VoidConfirmDialog`'s `open`/`onClose` prop passthrough to `Modal`) — this lets `ProductsPage.tsx` conditionally render the dialog OR pass `product={deleteTarget}` unconditionally; either works since `Modal` returns `null` when `open` is false.

---

### `packages/frontend/src/components/catalog/MopDeleteConfirmDialog.tsx` (new component, request-response)

**Analog:** identical structure to `ProductDeleteConfirmDialog.tsx` above. Swap `Product`→`Mop`, `/products`→`/mops`, `['products']`→`['mops']`, title/body/button copy per UI-SPEC.md Copywriting Contract (`Delete MOP` / "Are you sure you want to delete this mode of payment? This cannot be undone." / `Delete MOP` / `Deleting...` / "Failed to delete this mode of payment. Please try again.").

---

### `packages/frontend/src/components/users/UserDeleteConfirmDialog.tsx` (new component, request-response)

**Analog A (dialog structure):** `VoidConfirmDialog.tsx` (as above)
**Analog B (error-code-to-message mapping):** `packages/frontend/src/pages/InviteRegisterPage.tsx`, lines 47-54:
```typescript
const apiError = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
if (apiError === 'INVITE_INVALID') {
  setTokenValid(false);
} else {
  setError('root', { message: 'Something went wrong. Please try again.' });
}
```

Adapt this mapping shape for the two D-08/D-09 error codes, defined locally since `useMutation`'s `error` object needs manual code extraction (mirrors the same `err.response?.data?.error` shape used codebase-wide):

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../Modal';
import { api } from '../../lib/axios';
import type { User } from '@alejinput/shared';

interface UserDeleteConfirmDialogProps {
  user: User | null;
  onClose: () => void;
}

function getErrorMessage(err: unknown): string {
  const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
  if (code === 'CANNOT_DELETE_SELF') return 'You cannot delete your own account.';
  if (code === 'LAST_ADMIN') return 'Cannot delete the last remaining admin.';
  return 'Failed to delete user. Please try again.';
}

export function UserDeleteConfirmDialog({ user, onClose }: UserDeleteConfirmDialogProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (userId: number) => api.delete(`/users/${userId}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
  });

  const isPending = deleteMutation.isPending;

  return (
    <Modal
      open={user !== null}
      onClose={isPending ? undefined : onClose}
      title="Delete User"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-sm font-normal hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => user && deleteMutation.mutate(user.id)}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-normal hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Deleting...' : 'Delete User'}
          </button>
        </>
      }
    >
      <p className="text-sm font-normal text-gray-900 dark:text-gray-100">
        Are you sure you want to delete this user? This cannot be undone.
      </p>
      {deleteMutation.isError && (
        <p className="text-sm font-normal text-red-600 dark:text-red-400 mt-2">
          {getErrorMessage(deleteMutation.error)}
        </p>
      )}
    </Modal>
  );
}
```

Note: `User` type is not currently exported from `@alejinput/shared`'s barrel the way `Product`/`Mop` are consumed on `ProductsPage`/`MopsPage` — `UsersPage.tsx` today defines its own local `interface User` (lines 24-33). Import `User` from `packages/shared/src/types/user.ts` if it's exported there, or reuse `UsersPage.tsx`'s local `User` interface shape (same fields) if it isn't part of the shared barrel yet — verify at implementation time via `packages/shared/src/types/index.ts`.

---

## Shared Patterns

### Router-level admin guard
**Source:** `packages/backend/src/middleware/requireRole.ts` (lines 9-17), mounted via `productsRouter.use(requireRole('admin'))` / `mopsRouter.use(...)` / `usersRouter.use(...)` at the top of each route file.
**Apply to:** All three new delete routes — no additional per-route guard needed, router-level mount already covers them.

### Error handler contract
**Source:** `packages/backend/src/middleware/errorHandler.ts` (lines 6-23) — reads `err.statusCode` and `err.code` off any thrown/rejected error, Express 5 auto-forwards async errors.
**Apply to:** All three delete routes — for straightforward validation/404 cases use `res.status(x).json({ error: 'CODE' })` directly (matches existing route style, e.g. `products.ts` line 144, `users.ts` line 175); reserve `throw Object.assign(new Error(...), { statusCode, code })` (per `auth.ts` lines 204-208) only if delete logic ever needs to be wrapped in a `prisma.$transaction` (not required by D-03, since delete touches only the target row, no cross-table writes).

### Soft-delete filter extension
**Source:** `packages/backend/src/lib/prisma.ts` `$extends` block (lines 24-67).
**Apply to:** `Product`, `Mop`, `User` findMany overrides — add `deletedAt: null` alongside existing `isActive: true`. See detailed nuance under the `prisma.ts` pattern assignment above re: not overriding `deletedAt` the same way `isActive` is overridden in GET-all routes.

### Session-kill direct SQL
**Source:** `packages/backend/src/routes/users.ts` `POST /:id/reset-password` (lines 192-195); precedent also in `auth.ts` `/change-password` (lines 258-261, the session-preserving variant — NOT used for delete).
**Apply to:** New User delete route (D-10) — reuse verbatim, no `session_id !=` exclusion clause (unlike change-password):
```typescript
await sessionPool.query(
  `DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ?`,
  [targetId],
);
```

### Pessimistic row-action button pattern
**Source:** `packages/frontend/src/pages/ProductsPage.tsx` `pendingToggleId` state (line 24) + disabled-button styling (lines 78-79, 86-95); `UsersPage.tsx` `pendingCanEditId`/`pendingResetId` (lines 52-53).
**Apply to:** All three pages' new `deleteTarget` state and Delete button disabled logic — click only sets local state to open the dialog (synchronous, no pending state needed at click time per UI-SPEC.md §Row-level pending state); the actual pending/disabled round-trip lives inside the new confirm dialogs' own buttons, exactly like `VoidConfirmDialog`.

### Confirm-dialog shape (Modal + destructive button)
**Source:** `packages/frontend/src/components/sales/VoidConfirmDialog.tsx` (full file) and `packages/frontend/src/components/Modal.tsx` (lines 13-66, `open`/`onClose`/`title`/`children`/`footer` contract; `onClose={undefined}` blocks escape/backdrop-close during pending per Rule 10).
**Apply to:** `ProductDeleteConfirmDialog.tsx`, `MopDeleteConfirmDialog.tsx`, `UserDeleteConfirmDialog.tsx` — exact Cancel/Confirm button Tailwind classes given verbatim in UI-SPEC.md §Component & Interaction Contract (also reproduced in the three dialog code blocks above).

## No Analog Found

None — every file in scope has at least a role-match analog in the existing codebase. This phase is explicitly additive on top of well-established patterns (toggle routes, VoidConfirmDialog, ProductModal props convention, reset-password session-kill).

## Metadata

**Analog search scope:** `packages/backend/prisma/`, `packages/backend/src/routes/`, `packages/backend/src/lib/`, `packages/backend/src/middleware/`, `packages/frontend/src/pages/`, `packages/frontend/src/components/` (catalog, users, sales, shift), `packages/frontend/src/stores/`, `packages/shared/src/types/`
**Files scanned:** 17 (schema.prisma, prisma.ts, requireRole.ts, errorHandler.ts, products.ts, mops.ts, users.ts, auth.ts, ProductsPage.tsx, MopsPage.tsx, UsersPage.tsx, VoidConfirmDialog.tsx, ForceClockOutConfirmDialog.tsx, Modal.tsx, ResetPasswordModal.tsx, ProductModal.tsx, InviteRegisterPage.tsx, authStore.ts, product.ts, mop.ts)
**Pattern extraction date:** 2026-07-21
