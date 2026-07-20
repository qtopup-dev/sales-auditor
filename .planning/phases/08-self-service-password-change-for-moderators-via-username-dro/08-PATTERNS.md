# Phase 8: Self-Service Password Change - Pattern Map

**Mapped:** 2026-07-20
**Files analyzed:** 5 (2 backend, 3 frontend)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `packages/backend/src/routes/auth.ts` (add `POST /change-password`) | route (modify existing) | request-response | same file, `POST /invite/:token` (lines 175-217) + `users.ts` reset-password (lines 157-199) | exact (route shape) + exact (session-invalidation SQL) |
| `packages/frontend/src/layouts/AuthenticatedLayout.tsx` (modify `SidebarContent`, lines 93-103) | component (modify existing) | request-response | same file, mobile-drawer Escape handler (lines 111-119) + `Modal.tsx` Escape pattern | role-match (new dropdown sub-pattern, no exact prior dropdown) |
| `packages/frontend/src/components/users/ChangePasswordModal.tsx` (new) | component (modal form) | request-response | `packages/frontend/src/pages/InviteRegisterPage.tsx` (password+confirm fields, lines 116-164) + `packages/frontend/src/components/catalog/ProductModal.tsx` (modal form + generic error, whole file) + `packages/frontend/src/components/users/ResetPasswordModal.tsx` (success/"Done" footer swap, whole file) | exact (composite of 3 strong analogs) |
| Username dropdown menu (sub-component, likely inline in `AuthenticatedLayout.tsx` or extracted to `packages/frontend/src/components/UserMenu.tsx`) | component | event-driven (UI toggle) | no direct analog — new pattern; nearest precedent is `Modal.tsx` open/close + Escape wiring | no analog (see below) |
| Backend validation for new password | middleware/validation (inline `express-validator` array) | request-response | `packages/backend/src/routes/auth.ts` `registerValidation` (lines 18-26) | exact |

## Pattern Assignments

### `packages/backend/src/routes/auth.ts` — new `POST /api/auth/change-password` (route, request-response)

**Analog 1 (route shape + requireAuth-per-route convention):** `packages/backend/src/routes/auth.ts`, `GET /me` (lines 91-111)

`authRouter` is mounted **unauthenticated** at the top level (`app.use('/api/auth', authRouter)` in `app.ts` line 100) — it is NOT under `protectedRouter`'s router-level `requireAuth`. Any endpoint in `auth.ts` that requires a session must apply `requireAuth` per-route, exactly like `/me` does:

```typescript
// packages/backend/src/routes/auth.ts lines 91-93
authRouter.get('/me', requireAuth, async (req, res) => {
```

Follow this exact convention for the new route:
```typescript
authRouter.post('/change-password', requireAuth, changePasswordValidation, async (req: Request, res: Response) => {
```

**Analog 2 (validation schema to copy):** `registerValidation` (lines 18-26)
```typescript
const registerValidation = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 2, max: 100 }).withMessage('Username must be 2-100 characters'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];
```
New validation only needs the password rule (D-04/D-05 — confirm field is client-only, never sent to server):
```typescript
const changePasswordValidation = [
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];
```
Error response shape to copy verbatim (lines 36-40):
```typescript
const errors = validationResult(req);
if (!errors.isEmpty()) {
  res.status(400).json({ error: 'VALIDATION_ERROR', details: errors.array() });
  return;
}
```

**Analog 3 (bcrypt hashing, cost 12):** `packages/backend/src/routes/auth.ts` line 188 (invite registration) and `packages/backend/src/routes/users.ts` line 181 (admin reset)
```typescript
const passwordHash = await bcrypt.hash(newPassword, 12); // cost factor 12 per CLAUDE.md
```

**Analog 4 (Prisma update by current user id):** `packages/backend/src/routes/users.ts` lines 184-187 — adapt from `targetId` to `req.session.userId!`:
```typescript
await prisma.user.update({
  where: { id: req.session.userId!, organizationId: req.session.organizationId! },
  data: { passwordHash },
});
```

**Analog 5 (session-invalidation SQL — MUST be modified, not copied verbatim):** `packages/backend/src/routes/users.ts` lines 189-195
```typescript
// Existing admin-reset pattern — invalidates ALL sessions for target user (unconditional)
await sessionPool.query(
  `DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ?`,
  [targetId],
);
```
Per CONTEXT.md D-06, this phase's query must additionally exclude the current session. Confirmed sessions table schema (from `.planning/phases/02-auth-catalogs/02-RESEARCH.md` line 380 and `packages/backend/src/lib/db.ts`): columns are `session_id VARCHAR` (primary key, the actual express-session ID — NOT nested inside `data`), `expires BIGINT`, `data TEXT (JSON)`. So the exclusion is a plain column comparison against `req.sessionID`, not another `JSON_EXTRACT`:
```typescript
await sessionPool.query(
  `DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ? AND session_id != ?`,
  [req.session.userId, req.sessionID],
);
```
Import needed: `sessionPool` from `packages/backend/src/lib/db.ts` (see `packages/backend/src/routes/users.ts` line 6):
```typescript
import { sessionPool } from '../lib/db.js';
```

**Response shape:** No password is returned (unlike admin reset, which returns `tempPassword`). Mirror the simple `{ ok: true }` shape used by `/logout` (line 123):
```typescript
res.json({ ok: true });
```

**Auth/session type declarations already exist** — no changes needed to `requireAuth.ts`'s `SessionData` augmentation (`userId`, `role`, `username`, `organizationId` already declared, lines 7-14).

---

### `packages/frontend/src/layouts/AuthenticatedLayout.tsx` — replace lines 93-103 (component, request-response + UI state)

**Analog (structure to replace):**
```typescript
// packages/frontend/src/layouts/AuthenticatedLayout.tsx lines 93-103 — CURRENT (to be replaced)
<div className="px-4 py-4 border-t border-gray-200 dark:border-gray-800">
  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 truncate">{user?.username}</p>
  <button
    type="button"
    onClick={handleLogout}
    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950 rounded"
  >
    Log Out
  </button>
</div>
```
`handleLogout` (lines 35-40) is unchanged — reuse verbatim inside the new dropdown's "Log Out" menu item:
```typescript
const handleLogout = async () => {
  await api.post('/auth/logout');
  queryClient.clear();
  setUser(null);
  navigate('/login', { replace: true });
};
```

**Escape-to-close analog:** the mobile drawer's `useEffect` (lines 111-119) — reuse this exact shape for the dropdown's Escape handler:
```typescript
useEffect(() => {
  if (!drawerOpen) return;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setDrawerOpen(false);
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}, [drawerOpen]);
```
Same pattern used in `Modal.tsx` lines 15-22 (conditional listener + cleanup). Apply identically for `dropdownOpen` state.

**No existing click-outside analog in this codebase** — this is a genuinely new interaction pattern (see "No Analog Found" below). The Escape-key wiring above is directly reusable; click-outside needs a `useRef` + `document.addEventListener('mousedown', ...)` handler that checks `ref.current?.contains(e.target)`, following standard React idiom (not project-specific, but keep the `useEffect` cleanup shape consistent with the two analogs above).

**min-h-[44px] touch target convention** — already used for nav links (line 58-59) and the dark-mode toggle button (line 75); UI-SPEC.md requires the same for the dropdown trigger and both menu items.

---

### `packages/frontend/src/components/users/ChangePasswordModal.tsx` (new — component, request-response)

**Analog 1 (Modal wrapper usage + pessimistic isPending-blocks-close):** `packages/frontend/src/components/catalog/ProductModal.tsx` (whole file, 146 lines)
```typescript
// Modal invocation pattern — lines 66-70
<Modal
  open
  onClose={isPending ? undefined : onClose} // blocked during save (CLAUDE.md Rule 10)
  title={title}
  footer={...}
>
```
Generic server-error copy to reuse verbatim (line 140):
```typescript
{error && (
  <p className="text-sm text-red-600 dark:text-red-400 mt-1">Something went wrong. Please try again.</p>
)}
```

**Analog 2 (new-password + confirm-password fields with react-hook-form `watch` + `validate`):** `packages/frontend/src/pages/InviteRegisterPage.tsx` lines 116-164 — this is a near-exact match for D-03/D-04/D-05:
```typescript
const password = watch('password');
...
{...register('password', {
  required: 'Password is required',
  minLength: { value: 8, message: 'Password must be at least 8 characters.' },
})}
...
{...register('confirmPassword', {
  required: 'Please confirm your password',
  validate: (value) => value === password || 'Passwords do not match.',
})}
```
Field names should follow UI-SPEC.md copy: label "New Password" / "Confirm New Password" — rename form fields to `newPassword` / `confirmNewPassword`, adjust `watch('newPassword')` accordingly. Required-message copy must match UI-SPEC.md exactly: "New password is required." and "Please confirm your new password." (UI-SPEC.md differs slightly in punctuation from `InviteRegisterPage.tsx`'s current copy — use UI-SPEC.md's wording, not the source file's).

**Analog 3 (post-success footer swap to single "Done" button, no auto-close):** `packages/frontend/src/components/users/ResetPasswordModal.tsx` (whole file) — copy the "always closeable once result exists" behavior and the `Done` button styling:
```typescript
// lines 29-37
footer={
  <button
    type="button"
    onClick={onClose}
    className="px-4 py-2 h-10 bg-blue-600 text-white rounded-md text-sm font-normal hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
    Done
  </button>
}
```
This phase's modal needs conditional footer content (form footer pre-submit vs. "Done" post-success) — pattern is: keep a local `success` boolean (e.g. from `useState` or `mutation.isSuccess`), and swap both `children` (form vs. success message) and `footer` based on that flag, matching how `ResetPasswordModal.tsx` is a single-state-always version of what this modal needs as a two-state (form → success) version.

**Mutation pattern (useMutation + inline setError on failure):** `packages/frontend/src/components/users/UserModal.tsx` lines 38-51 — for the 409-style pattern; this phase's errors are 400 (validation) and 500 (generic), so combine with `ProductModal.tsx`'s `error` handling (`createMutation.error`) rather than `setError` per-field for server errors. Confirm-field mismatch stays entirely client-side per CONTEXT.md discretion note (never sent to server).

**Component/API call:**
```typescript
api.post('/auth/change-password', { newPassword: data.newPassword }).then((r) => r.data)
```
(mirrors `api.patch('/users/${user!.id}/username', ...)` call shape in `UserModal.tsx` line 40 and `api.post('/auth/logout')` in `AuthenticatedLayout.tsx` line 36 — both use the shared `api` instance from `packages/frontend/src/lib/axios.ts`, which already sets `withCredentials: true` and handles 401 globally.)

---

## Shared Patterns

### Pessimistic UI / disabled-during-save
**Source:** `packages/frontend/src/components/catalog/ProductModal.tsx` lines 69, 76, 84, 101, 121 (CLAUDE.md Rule 10)
**Apply to:** `ChangePasswordModal.tsx` — all inputs and both footer buttons disabled while `isPending`; `Modal`'s `onClose` prop set to `undefined` during save.

### Modal wrapper (title/body/footer slots, Escape + backdrop-click close, blocked during save)
**Source:** `packages/frontend/src/components/Modal.tsx` (whole file, 67 lines)
**Apply to:** `ChangePasswordModal.tsx` — no new modal primitive needed per UI-SPEC.md.

### bcrypt cost-12 hashing
**Source:** `packages/backend/src/routes/auth.ts` line 188; `packages/backend/src/routes/users.ts` line 181
**Apply to:** new `POST /api/auth/change-password` handler.

### Direct-SQL session invalidation via `sessionPool`
**Source:** `packages/backend/src/routes/users.ts` lines 189-195; `packages/backend/src/lib/db.ts` (pool definition)
**Apply to:** new route — modified to exclude `req.sessionID` (see Pattern Assignments above). This is the one place this phase diverges from the existing analog rather than copying verbatim.

### express-validator body validation + VALIDATION_ERROR response shape
**Source:** `packages/backend/src/routes/auth.ts` lines 13-26, 36-40
**Apply to:** new `changePasswordValidation` array and its error-check block.

### requireAuth per-route (not router-level) inside `authRouter`
**Source:** `packages/backend/src/routes/auth.ts` line 91 (`GET /me`)
**Apply to:** new `POST /change-password` — must include `requireAuth` explicitly since `authRouter` itself is mounted unauthenticated in `app.ts` line 100.

### Generic server-error copy ("Something went wrong. Please try again.")
**Source:** `packages/frontend/src/components/catalog/ProductModal.tsx` line 140 (also `MopModal.tsx`, `ReceiverModal.tsx` per UI-SPEC.md)
**Apply to:** `ChangePasswordModal.tsx` server/generic error state.

### New-password + confirm-password field pair with react-hook-form `watch`/`validate`
**Source:** `packages/frontend/src/pages/InviteRegisterPage.tsx` lines 116-164
**Apply to:** `ChangePasswordModal.tsx` form fields (rename to `newPassword`/`confirmNewPassword`, adjust copy per UI-SPEC.md).

---

## No Analog Found

| File/Feature | Role | Data Flow | Reason |
|---------------|------|-----------|--------|
| Username dropdown menu (open/close, upward panel, click-outside) | component | event-driven (UI toggle) | No dropdown-menu component exists anywhere in the codebase (UI-SPEC.md line 99 confirms: "No prior dropdown-menu component exists in the codebase — this is a new pattern"). Escape-key handling has a direct analog (`Modal.tsx`, mobile drawer); click-outside does not — implement with standard `useRef` + `mousedown` listener, keeping the `useEffect` cleanup shape consistent with the Escape analog. |

## Metadata

**Analog search scope:** `packages/backend/src/routes/`, `packages/backend/src/lib/`, `packages/backend/src/middleware/`, `packages/frontend/src/layouts/`, `packages/frontend/src/components/`, `packages/frontend/src/pages/`, `packages/frontend/src/stores/`, `packages/frontend/src/lib/`
**Files scanned:** ~15 (routes: auth.ts, users.ts, db.ts, requireAuth.ts, errorHandler.ts; frontend: AuthenticatedLayout.tsx, Modal.tsx, UserModal.tsx, ProductModal.tsx, ResetPasswordModal.tsx, InviteRegisterPage.tsx, authStore.ts, axios.ts; plus prior-phase RESEARCH.md/PATTERNS.md for sessions-table schema confirmation)
**Pattern extraction date:** 2026-07-20
