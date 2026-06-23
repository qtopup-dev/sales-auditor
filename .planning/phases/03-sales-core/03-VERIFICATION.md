---
phase: 03-sales-core
verified: 2026-06-23T00:00:00Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Add Row end-to-end flow in browser"
    expected: "Moderator clicks Add Row, selects product from combo (price auto-populates), selects MOP, enters receiver name, clicks Save Row — new row appears at top without page reload"
    why_human: "Cannot verify React Query refetch timing, virtual scroll scroll-to-index, and DOM rendering without a running browser session"
  - test: "Inline cell edit on blur"
    expected: "Moderator clicks an editable cell — it switches to an input; on blur the cell is disabled with a spinner; after round-trip the cell shows the server-returned value and Date Edited column updates to new timestamp"
    why_human: "Cell state machine timing (active→pending→idle) and Date Edited column update require live browser interaction"
  - test: "Void row confirmation flow"
    expected: "Admin clicks Void, sees confirmation modal, both buttons disable during round-trip, row appears with strikethrough and bg-red-50 after success; moderator attempt returns 403 and modal is not reachable"
    why_human: "Modal lock behavior (Escape blocked while in-flight) and RBAC 403 response require live request"
  - test: "Audit drawer for admin"
    expected: "Admin clicks Audit button, right-side 400px drawer opens showing audit entries newest-first with timestamp, username, action type, and old→new values for update entries; Escape closes it; moderator does not see Audit button"
    why_human: "Drawer animation, Escape key close, and role-gated button visibility require browser session"
  - test: "Virtual scroll performance with many rows"
    expected: "Loading 200+ rows does not freeze the browser; Notes textarea row height adjusts without overlapping adjacent rows after an edit"
    why_human: "Performance and ResizeObserver-driven height adjustment require a real browser with many data rows"
  - test: "Inactive product/MOP not appearing in Add Row combos"
    expected: "Deactivated products and MOPs do not appear in the AsyncSelect combo boxes; existing rows still show their snapshotted names correctly"
    why_human: "Requires catalog admin to deactivate an item then verify combo list in sales sheet"
---

# Phase 3: Sales Core Verification Report

**Phase Goal:** Moderators can enter, edit, and void sales rows in a spreadsheet-like interface, and every write is captured in an immutable audit log written in the same database transaction.
**Verified:** 2026-06-23
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A moderator can click "Add Row", select a product from searchable combo, see price auto-populate, select MOP, enter receiver, save — row appears newest-first without page reload | ✓ VERIFIED | AddRowForm.tsx: AsyncSelect with defaultOptions+cacheOptions for product/MOP; setPriceDisplay on product change; onSuccess invalidates ['sales'] and calls onSaveSuccess() which triggers scrollToIndex(0); POST /api/sales exists with product+MOP+receiver validation |
| 2 | Moderator can click any editable cell, edit inline, cell saves on blur — cell disabled with spinner during round-trip, Date Edited updates on every save | ✓ VERIFIED | EditableCell.tsx: isThisCellPending renders spinner; setPending(true) before patchMutation.mutate(); clearActiveCell()+setPending(false) in onSuccess/onError; PATCH handler sets lastEditedById+lastEditedByUsername on every update; Prisma @updatedAt auto-updates updatedAt; SalesTable renders Date Edited from sale.updatedAt when lastEditedById is not null |
| 3 | Audit log entry created inside same DB transaction as every create/edit/void — rollback guarantees (AUDIT-02 hard constraint) | ✓ VERIFIED | sales.ts has `prisma.$transaction` at lines 154, 248, 405 for POST, PATCH, and void handlers respectively; each transaction creates both the data mutation AND the auditLog record; productId PATCH creates 3 audit entries via tx.auditLog.createMany inside same transaction |
| 4 | Voided rows visible with strikethrough; only admin can void — moderator attempts return 403; moderators cannot edit rows they didn't create or when edit rights are off | ✓ VERIFIED | SalesTable: voided rows get bg-red-50 and line-through in EditableCell (idle state); POST /:id/void guarded by requireRole('admin') before handler; PATCH checks (sale.createdById === userId && canEdit) OR admin; frontend canEdit guard at EditableCell line 37-40 (UI only, backend enforces) |
| 5 | Virtual scroll handles large row counts without freezing; Notes textarea row height measured by virtualizer after edit | ✓ VERIFIED | SalesTable.tsx: useVirtualizer with measureElement (getBoundingClientRect().height), data-index on every row, ref={virtualizer.measureElement}; EditableCell Notes textarea uses e.target.style.height auto-resize on onChange; overscan: 3; minWidth 1160px for mobile scroll |
| 6 | Inactive products and MOPs do not appear in combo boxes; backend enforces RBAC on every mutation, returning 403 for unauthorized attempts | ✓ VERIFIED | POST /api/sales and PATCH product change use tx.product.findFirst({ isActive: true }) and tx.mop.findFirst({ isActive: true }) inside transaction; GET /api/products/$extends default filters isActive=true (existing pattern); requireRole('admin') on void+audit routes; PATCH ownership check throws 403 |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/backend/prisma/schema.prisma` | Sale model with createdByUsername, AuditLog with userUsername | ✓ VERIFIED | createdByUsername String @db.VarChar(100) at line 118; lastEditedByUsername String? @db.VarChar(100) at line 121; userUsername String @db.VarChar(100) at line 141; DECIMAL(10,2) on priceSnapshot |
| `packages/backend/src/middleware/requireAuth.ts` | SessionData with username and organizationId | ✓ VERIFIED | Interface at lines 8-13 contains username: string and organizationId: number |
| `packages/backend/src/routes/auth.ts` | Login writes username + organizationId to session | ✓ VERIFIED | req.session.username = user.username at line 66; req.session.organizationId at line 67 |
| `packages/backend/src/routes/sales.ts` | All 5 endpoints with transactional audit writes | ✓ VERIFIED | 478 lines; exports salesRouter; GET /, POST /, PATCH /:id, POST /:id/void, GET /:id/audit all present; prisma.$transaction in all 3 mutations |
| `packages/backend/src/app.ts` | salesRouter mounted on protectedRouter | ✓ VERIFIED | Line 88: protectedRouter.use('/sales', salesRouter); inside app.use('/api', requireAuth, protectedRouter) at line 89 |
| `packages/frontend/src/stores/salesEditStore.ts` | Zustand v5 store with D-05 locked shape | ✓ VERIFIED | All 8 state fields and 10 actions present; Zustand v5 double-call syntax create<SalesEditState>()() |
| `packages/frontend/src/components/sales/VoidConfirmDialog.tsx` | Void confirmation modal with pessimistic UI | ✓ VERIFIED | Modal lock pattern onClose={isPending ? undefined : closeVoidDialog}; both buttons disabled when isPending; "Voiding..." label; invalidates ['sales'] on success |
| `packages/frontend/src/components/sales/SalesTable.tsx` | react-table v8 + react-virtual v3 virtual scroll | ✓ VERIFIED | useVirtualizer with measureElement; data-index on every row; ref={virtualizer.measureElement}; sticky header; minWidth 1160px; bg-red-50 on voided rows |
| `packages/frontend/src/components/sales/AddRowForm.tsx` | Inline Add Row form as virtual row 0 | ✓ VERIFIED | AsyncSelect with menuPortalTarget={document.body}; price auto-populate via setPriceDisplay; disabled={isPending || !isFormValid} on Save Row; Escape dismisses; onSaveSuccess() scrolls to top |
| `packages/frontend/src/components/sales/AuditDrawer.tsx` | Slide-in audit drawer for admin | ✓ VERIFIED | queryKey ['sales', openAuditSaleId, 'audit']; enabled: openAuditSaleId !== null; if (!isOpen) return null; Escape handler; overlay click closes; aria-modal=true |
| `packages/frontend/src/components/sales/EditableCell.tsx` | Cell display-to-input state machine with blur-save | ✓ VERIFIED | display→active→pending→display cycle; isThisCellPending spinner; draftValue from Zustand; setPending(true) before mutate; clearActiveCell in onSuccess and onError; menuPortalTarget on AsyncSelect; D-03 isAddRowOpen guard; Escape to discard |
| `packages/frontend/src/pages/SalesPage.tsx` | Full SalesPage integrating all Phase 3 components | ✓ VERIFIED | SalesTable, AuditDrawer (admin-only), VoidConfirmDialog all rendered; flex-1 min-h-0 on table container; queryKey ['sales']; isAddRowOpen disables Add Row button |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/backend/src/routes/auth.ts` | express-session SessionData | req.session.username at line 66 | ✓ WIRED | Both username and organizationId written before session.save() |
| `packages/backend/src/app.ts` | `packages/backend/src/routes/sales.ts` | protectedRouter.use('/sales', salesRouter) at line 88 | ✓ WIRED | Inside app.use('/api', requireAuth, protectedRouter) — unauthenticated returns 401 |
| `packages/backend/src/routes/sales.ts` | Prisma $transaction | prisma.$transaction at lines 154, 248, 405 | ✓ WIRED | Three mutation handlers each wrap data write + auditLog.create in same transaction |
| `packages/frontend/src/components/sales/VoidConfirmDialog.tsx` | /api/sales/:id/void | api.post(`/sales/${saleId}/void`) in mutationFn | ✓ WIRED | useMutation fires POST; onSuccess invalidates ['sales'] |
| `packages/frontend/src/components/sales/AuditDrawer.tsx` | /api/sales/:id/audit | useQuery queryFn: api.get(`/sales/${openAuditSaleId}/audit`) | ✓ WIRED | enabled: openAuditSaleId !== null prevents spurious calls |
| `packages/frontend/src/components/sales/AddRowForm.tsx` | /api/sales POST | api.post('/sales', data) in mutationFn | ✓ WIRED | Invalidates ['sales'] and calls onSaveSuccess() on success |
| `packages/frontend/src/components/sales/EditableCell.tsx` | /api/sales/:id PATCH | api.patch(`/sales/${saleId}`, { field, value }) in mutationFn | ✓ WIRED | setPending(true) before mutate; clearActiveCell in both onSuccess and onError |
| `packages/frontend/src/pages/SalesPage.tsx` | SalesTable, AuditDrawer, VoidConfirmDialog | Direct JSX render with sales={data} prop | ✓ WIRED | AuditDrawer gated by user?.role === 'admin'; VoidConfirmDialog rendered for all (store-controlled visibility) |
| `packages/frontend/src/components/sales/SalesTable.tsx` | EditableCell | import { EditableCell } from './EditableCell' | ✓ WIRED | Stub removed; real import present; used in Product, MOP, Receiver, Notes columns |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SalesPage.tsx` | sales | useQuery(['sales']) → GET /api/sales → prisma.sale.findMany | Yes — findMany with org scope, status filter, orderBy | ✓ FLOWING |
| `AuditDrawer.tsx` | entries | useQuery(['sales', id, 'audit']) → GET /api/sales/:id/audit → prisma.auditLog.findMany | Yes — findMany filtered by saleId+organizationId, ordered by createdAt desc | ✓ FLOWING |
| `EditableCell.tsx` | draftValue | Zustand salesEditStore — set by setActiveCell from sale[field] prop | Yes — initialized from sale object from React Query cache | ✓ FLOWING |
| `AddRowForm.tsx` | priceDisplay | setPriceDisplay called on AsyncSelect onChange from API response option.price | Yes — price comes from /api/products response which serializes Decimal.toFixed(2) | ✓ FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — tests require a running dev server and live browser session. The codebase produces runnable code but spot-checks (curl endpoints, module exports) cannot be meaningfully done without a live DB connection.

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SALES-01 | 02, 06 | Newest-first table | ✓ SATISFIED | GET /: orderBy: { createdAt: 'desc' }; SalesTable renders in order from React Query |
| SALES-02 | 04, 06 | Virtual scroll | ✓ SATISFIED | useVirtualizer in SalesTable.tsx |
| SALES-03 | 04, 06 | Dynamic row heights | ✓ SATISFIED | measureElement + data-index + Notes textarea auto-height in EditableCell |
| SALES-04 | 04, 06 | Add Row form | ✓ SATISFIED | AddRowForm.tsx rendered as virtual row 0 when isAddRowOpen |
| SALES-05 | 06 | Click to edit inline | ✓ SATISFIED | EditableCell handleClick → setActiveCell → input/select renders |
| SALES-06 | 06 | Save on blur, disabled + spinner | ✓ SATISFIED | handleBlur calls setPending(true)+patchMutation.mutate(); isThisCellPending renders spinner and disabled state |
| SALES-07 | 04, 06 | Row columns: Product, Price, MOP, Receiver, Notes, Date Edited | ✓ SATISFIED | All 7 columns defined in SalesTable columns array |
| SALES-08 | 04, 06 | Product: searchable combo, active only | ✓ SATISFIED | AsyncSelect with loadProducts calling GET /api/products (active only via $extends); EditableCell productId uses AsyncSelect |
| SALES-09 | 02, 04 | Price auto-populates and locks | ✓ SATISFIED | AddRowForm: setPriceDisplay on product change; Price column is read-only span (not EditableCell); backend: priceSnapshot: product.price in POST |
| SALES-10 | 04, 06 | MOP: searchable combo, active only | ✓ SATISFIED | AsyncSelect with loadMops calling GET /api/mops (active only via $extends) |
| SALES-11 | 02, 04 | Receiver: required free-text | ✓ SATISFIED | Backend: body('receiver').notEmpty(); AddRowForm: required rule; disabled={isPending || !isFormValid} until filled |
| SALES-12 | 04, 06 | Notes: optional, expands row | ✓ SATISFIED | Notes is optional in backend validation; EditableCell Notes textarea auto-height; AddRowForm textarea |
| SALES-13 | 02 | Date Edited updates on create/edit | ✓ SATISFIED | Prisma @updatedAt on Sale; PATCH sets lastEditedById; SalesTable shows updatedAt when lastEditedById is set |
| SALES-14 | 02, 04 | Product+MOP+Receiver required | ✓ SATISFIED | Backend validation; AddRowForm isFormValid guard |
| SALES-15 | 02, 04, 06 | Voided rows visible with strikethrough | ✓ SATISFIED | GET /: status: {in: ['active','void']}; SalesTable: bg-red-50; EditableCell line-through class |
| SALES-16 | 01, 02, 06 | Moderator edits own rows only + canEdit | ✓ SATISFIED | Backend PATCH: (createdById === userId && canEdit) OR admin; frontend canEdit guard in EditableCell |
| SALES-17 | 02, 04 | Inactive items hidden from combos, show on existing rows | ✓ SATISFIED | POST/PATCH validate isActive:true in tx; existing rows use productNameSnapshot/mopNameSnapshot (denormalized — never re-fetched from catalog) |
| SALES-18 | 04, 06 | Responsive, usable on mobile | ✓ SATISFIED | table minWidth: '1160px' with overflow-auto on SalesTable container — horizontal scroll on mobile |
| AUDIT-01 | 02, 06 | Every create/edit/void logged with user, field, old, new, action, timestamp | ✓ SATISFIED | All 3 mutation handlers write auditLog with userId, userUsername, action, fieldName, oldValue, newValue |
| AUDIT-02 | 01, 02, 06 | Audit record in same transaction — no orphan/rollback guarantee | ✓ SATISFIED | prisma.$transaction wraps data write + auditLog.create(Many) in all 3 mutation handlers |
| AUDIT-03 | 02, 05, 06 | Admin views per-row audit via drawer | ✓ SATISFIED | AuditDrawer: GET /api/sales/:id/audit (admin-only via requireRole); rendered only when user.role === 'admin' in SalesPage |
| ROLES-03 | 01, 02, 06 | Moderator with edit rights edits their rows | ✓ SATISFIED | PATCH check: sale.createdById === userId && requestingUser.canEdit |
| ROLES-04 | 01, 02, 06 | Moderator without edit rights: no edits | ✓ SATISFIED | requestingUser.canEdit === false causes 403 in PATCH |
| ROLES-05 | 01, 02, 06 | Admin edits any row | ✓ SATISFIED | req.session.role === 'admin' in PATCH canMutate check |
| ROLES-06 | 02, 03, 06 | Only admin can void | ✓ SATISFIED | requireRole('admin') middleware on POST /:id/void route |
| PROD-05 | 02, 04, 06 | Inactive products hidden from combos | ✓ SATISFIED | tx.product.findFirst({ isActive: true }) in POST and PATCH productId; GET /api/products default active-only filter |
| PAY-05 | 02, 04, 06 | Inactive MOPs hidden from combos | ✓ SATISFIED | tx.mop.findFirst({ isActive: true }) in POST; GET /api/mops default active-only filter |

**All 28 Phase 3 requirement IDs satisfied.**

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/frontend/src/components/sales/EditableCell.tsx` | 86 | `setActiveCell(sale.id, field, String(sale[field as keyof Sale] ?? ''))` — initializes draftValue from the sale prop (React Query cache) on click rather than Zustand. This is intentional: draft is only copied once at activation, then lives in Zustand exclusively. Not a stub. | ℹ️ Info | None — pattern is correct per STATE.md design decision |
| `packages/frontend/src/components/sales/AddRowForm.tsx` | 108 | `value={null}` on AsyncSelect — controlled mode but value is always null; selection goes via field.onChange only | ℹ️ Info | react-select controlled pattern; keeps combo visually clear after selection; no functional issue |

No TODOs, FIXMEs, placeholder returns, or hardcoded empty data found in Phase 3 files.

---

### Human Verification Required

#### 1. Add Row end-to-end flow

**Test:** Log in as moderator. Navigate to /sales. Click "Add Row". In the Product combo, type a product name and select it. Verify the Price column auto-populates and is read-only. Select a MOP. Enter a receiver name. Click "Save Row".
**Expected:** Row appears at the top of the table immediately after save (virtual scroll scrolls to index 0); no page reload needed; row shows correct product name, price, MOP, receiver, current date in Date Edited column.
**Why human:** React Query cache invalidation timing, virtualizer scrollToIndex(0) behavior, and actual DOM update cannot be verified without a running browser session.

#### 2. Inline cell edit on blur with spinner

**Test:** Click an editable cell on a row you own (moderator with canEdit=true). Type a new value. Click outside the cell (blur).
**Expected:** Cell switches to an input on click; on blur the cell shows grayed-out text with a spinning indicator; after the PATCH round-trip completes, the cell shows the server-returned value and the "Date Edited" column updates to the current timestamp.
**Why human:** The display→active→pending→idle state machine timing and spinner visibility require a real PATCH round-trip in a browser.

#### 3. Void row confirmation and role enforcement

**Test (admin):** Log in as admin. Click "Void" on an active row. Confirm in the dialog — both buttons should be disabled while voiding is in-flight; "Void Row" button shows "Voiding...". After success, row shows strikethrough styling and bg-red-50 background.
**Test (moderator):** Log in as moderator. Verify no "Void" button appears on any row.
**Expected:** Backend returns 403 if a moderator somehow triggers a POST /:id/void (e.g. via curl). Admin-only void is enforced server-side.
**Why human:** Modal lock (Escape key blocked during round-trip), RBAC 403 response, and strikethrough rendering require a live browser session.

#### 4. Audit drawer admin-only

**Test:** Log in as admin. Click "Audit" on any row. The right-side drawer should open showing audit entries newest-first with timestamp, username, action (Created row / Updated {field} / Voided row), and old→new values for update entries.
**Test:** Log in as moderator. Verify no "Audit" button appears on any row.
**Expected:** Drawer closes on Escape key, overlay click, and X button. Entries load correctly from GET /api/sales/:id/audit.
**Why human:** Drawer open/close animation, Escape key handler, and role-gated button visibility require browser interaction.

#### 5. Virtual scroll performance

**Test:** Insert 200+ sales rows (or use seed data). Navigate to /sales.
**Expected:** Table renders without freezing; scrolling is smooth; Notes content with multiple lines causes the row height to expand without overlapping adjacent rows; after editing a Notes cell, the row re-measures height correctly.
**Why human:** ResizeObserver-driven height adjustment and browser rendering performance cannot be verified statically.

#### 6. Inactive catalog items filtered from combos

**Test:** As admin, deactivate one product and one MOP from the catalog page. Then as moderator, open Add Row form and open both combo boxes.
**Expected:** The deactivated product and MOP do not appear in the AsyncSelect options. Existing rows that reference those deactivated items still display their snapshotted names correctly.
**Why human:** Requires admin action in the catalog + verification in the sales combo boxes in the same session.

---

### Gaps Summary

No automated gaps found. All 6 roadmap success criteria are supported by implementation evidence in the codebase:

1. **Add Row flow** — AddRowForm.tsx wired to POST /api/sales; invalidation+scrollToIndex on success.
2. **Inline edit on blur** — EditableCell.tsx implements full state machine; PATCH handler updates lastEditedById+updatedAt.
3. **Transactional audit** — All three mutation handlers use prisma.$transaction wrapping both data write and auditLog creation.
4. **Void + RBAC** — requireRole('admin') on void route; PATCH ownership check with canEdit enforcement.
5. **Virtual scroll** — useVirtualizer with measureElement + dynamic Notes height.
6. **Active-only combos + backend RBAC** — isActive:true in all tx queries; requireRole on admin endpoints.

Six human verification items remain that require a running browser session with a live database to confirm end-to-end behavior.

---

_Verified: 2026-06-23_
_Verifier: Claude (gsd-verifier)_
