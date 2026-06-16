# Architecture Research — Sales Auditing Web App

**Researched:** 2026-06-16
**Confidence:** HIGH — all patterns below are established, well-documented, and directly applicable to the confirmed stack (React, Express, Prisma, MySQL).

---

## System Components

### Component Map

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  React SPA                                           │   │
│  │  ┌──────────────┐  ┌───────────────┐  ┌──────────┐  │   │
│  │  │  Auth Layer  │  │  Sales Sheet  │  │  Admin   │  │   │
│  │  │  (login,     │  │  (inline edit │  │  Dashboard│  │   │
│  │  │   invite)    │  │   virtual     │  │  (users,  │  │   │
│  │  └──────────────┘  │   scroll)     │  │  products,│  │   │
│  │                    └───────────────┘  │  MOPs,    │  │   │
│  │                                       │  audit)   │  │   │
│  │                                       └──────────┘  │   │
│  │  React Query (server state) + Zustand (UI state)    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │ HTTPS / REST JSON
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  VPS — Node.js Process                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Express App                                         │   │
│  │                                                      │   │
│  │  Global Middleware Stack:                            │   │
│  │  cors → helmet → json-body → authenticate → route   │   │
│  │                                                      │   │
│  │  Route Modules:                                      │   │
│  │  /auth    /users    /sales    /products    /mops     │   │
│  │  /audit                                              │   │
│  │                                                      │   │
│  │  Service Layer (business logic, audit writes)        │   │
│  │  Prisma Client (type-safe DB access)                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │ TCP / Prisma Protocol
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  MySQL Database                                             │
│  organizations · users · products · mops · sales           │
│  audit_log · invite_tokens                                  │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Owns |
|-----------|---------------|------|
| React SPA | All user interaction, display, inline editing | UI state, optimistic updates |
| Auth Layer (React) | Login form, token storage, invite flow, route guards | JWT in memory + httpOnly cookie |
| Sales Sheet (React) | Virtual-scroll table, inline cell editing, add-row | Cell edit state, pending mutations |
| Admin Dashboard (React) | User management, product/MOP catalog, audit log viewer, charts | Filter state, CSV export trigger |
| Express App | HTTP boundary, auth verification, RBAC enforcement | Request/response, JWT signing |
| Route Modules | Endpoint handlers per resource | Input validation, calling services |
| Service Layer | Business logic: ownership checks, price locking, audit writes | Database transactions |
| Prisma Client | Type-safe query execution, migrations | Schema, connection pool |
| MySQL | Persistent data, referential integrity | All tables |

---

## Data Flow

### Authentication Flow

```
Browser                   Express                   MySQL
  │                          │                        │
  │── POST /auth/login ──────▶│                        │
  │   { username, password }  │── SELECT user ────────▶│
  │                          │◀── user row ────────────│
  │                          │  bcrypt.compare()       │
  │◀── Set-Cookie: token ────│  jwt.sign({id, role})   │
  │    (httpOnly, secure)     │                        │
  │                          │                        │
  │── GET /sales ────────────▶│                        │
  │   Cookie: token           │  verifyJWT middleware  │
  │                          │  req.user = payload     │
  │                          │── SELECT sales ─────────▶│
  │◀── { data: [...] } ──────│◀── rows ────────────────│
```

### Sales Row Edit Flow (with Audit Log)

```
Browser                   Express / Service Layer          MySQL
  │                              │                           │
  │── PATCH /sales/:id ──────────▶│                           │
  │   { field: "mop_id",          │  1. Verify JWT            │
  │     value: 3 }                │  2. Load existing row ───▶│
  │                              │◀── current values ─────────│
  │                              │  3. Ownership check        │
  │                              │     (req.user.id ===       │
  │                              │      sale.created_by_id    │
  │                              │      OR role === 'admin')  │
  │                              │  4. Edit-rights check      │
  │                              │     (user.can_edit OR      │
  │                              │      role === 'admin')     │
  │                              │  5. BEGIN TRANSACTION ────▶│
  │                              │     UPDATE sales SET ...   │
  │                              │     INSERT audit_log ...   │
  │                              │     COMMIT ───────────────▶│
  │◀── { data: updatedRow } ─────│◀── success ────────────────│
```

### Optimistic UI Flow (React side)

```
User edits cell
  │
  ▼
onBlur / Enter keypress
  │
  ├─ Immediately update local state (optimistic)
  │   → Cell shows new value instantly, no spinner
  │
  ├─ Fire PATCH mutation (React Query useMutation)
  │
  ├─ On SUCCESS: invalidate ['sales'] query → background refetch confirms
  │
  └─ On ERROR:
      → Roll back local state to previous value
      → Show inline error indicator on cell
      → Re-focus cell for correction
```

### Invite Link Flow

```
Admin creates invite
  │
  ├─ Express generates crypto token (32 bytes, hex)
  ├─ Stores: invite_tokens { token_hash, role, expires_at, used_at=null }
  ├─ Returns full URL to admin: /register?token=<raw_token>
  │
Moderator opens link
  │
  ├─ GET /auth/invite/:token → validates token exists, not used, not expired
  ├─ POST /auth/register { token, username, password }
  │   → hash password, create user, mark token used_at=NOW()
  └─ Redirect to login
```

---

## Recommended Folder Structure

### Monorepo vs Separate Repos

**Recommendation: Monorepo with a single root, two top-level packages.**

Rationale: This is a small internal tool with one team. A monorepo eliminates deployment coordination overhead, allows sharing TypeScript types between front and back, and simplifies VPS deployment (one `git pull`, one process manager config). A tool like `npm workspaces` (built-in) is sufficient — no need for Turborepo or Nx at this scale.

```
alejinput/                          ← git root
├── package.json                    ← workspace root (npm workspaces)
├── .env                            ← never committed
├── .gitignore
│
├── packages/
│   ├── shared/                     ← optional: shared TS types
│   │   ├── package.json
│   │   └── src/
│   │       └── types/
│   │           ├── sale.ts
│   │           ├── user.ts
│   │           └── audit.ts
│   │
│   ├── backend/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── src/
│   │       ├── index.ts            ← app entry, server listen
│   │       ├── app.ts              ← Express setup, middleware registration
│   │       ├── config.ts           ← env vars, typed with zod
│   │       ├── routes/
│   │       │   ├── index.ts        ← mounts all routers
│   │       │   ├── auth.routes.ts
│   │       │   ├── users.routes.ts
│   │       │   ├── sales.routes.ts
│   │       │   ├── products.routes.ts
│   │       │   ├── mops.routes.ts
│   │       │   └── audit.routes.ts
│   │       ├── controllers/
│   │       │   ├── auth.controller.ts
│   │       │   ├── users.controller.ts
│   │       │   ├── sales.controller.ts
│   │       │   ├── products.controller.ts
│   │       │   ├── mops.controller.ts
│   │       │   └── audit.controller.ts
│   │       ├── services/
│   │       │   ├── auth.service.ts
│   │       │   ├── users.service.ts
│   │       │   ├── sales.service.ts  ← owns audit write logic
│   │       │   ├── products.service.ts
│   │       │   └── mops.service.ts
│   │       ├── middleware/
│   │       │   ├── authenticate.ts   ← JWT verification
│   │       │   ├── authorize.ts      ← RBAC role check
│   │       │   ├── errorHandler.ts   ← global error boundary
│   │       │   └── validateBody.ts   ← zod schema validation
│   │       ├── lib/
│   │       │   ├── prisma.ts         ← singleton PrismaClient
│   │       │   └── token.ts          ← jwt.sign / jwt.verify helpers
│   │       └── types/
│   │           └── express.d.ts      ← augment Request with req.user
│   │
│   └── frontend/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx             ← router root
│           ├── api/                ← all fetch/axios calls
│           │   ├── client.ts       ← axios instance, interceptors
│           │   ├── auth.api.ts
│           │   ├── sales.api.ts
│           │   ├── products.api.ts
│           │   ├── mops.api.ts
│           │   └── audit.api.ts
│           ├── hooks/              ← React Query hooks
│           │   ├── useSales.ts
│           │   ├── useProducts.ts
│           │   ├── useMops.ts
│           │   └── useAuditLog.ts
│           ├── components/
│           │   ├── sales/
│           │   │   ├── SalesSheet.tsx       ← virtual scroll container
│           │   │   ├── SalesRow.tsx
│           │   │   ├── EditableCell.tsx     ← inline edit logic
│           │   │   ├── ProductComboBox.tsx
│           │   │   └── MopComboBox.tsx
│           │   ├── admin/
│           │   │   ├── UserList.tsx
│           │   │   ├── ProductList.tsx
│           │   │   ├── MopList.tsx
│           │   │   ├── AuditLogTable.tsx
│           │   │   └── SalesDashboard.tsx
│           │   └── shared/
│           │       ├── AuthGuard.tsx
│           │       └── RoleGuard.tsx
│           ├── pages/
│           │   ├── LoginPage.tsx
│           │   ├── RegisterPage.tsx   ← invite token flow
│           │   ├── SalesPage.tsx
│           │   └── admin/
│           │       ├── AdminSalesPage.tsx
│           │       ├── UsersPage.tsx
│           │       ├── ProductsPage.tsx
│           │       ├── MopsPage.tsx
│           │       └── AuditPage.tsx
│           ├── store/              ← Zustand (UI-only state)
│           │   └── authStore.ts    ← current user, role
│           └── utils/
│               ├── formatters.ts
│               └── csvExport.ts
```

---

## Database Schema (ERD Description)

### Design Principles

- Every table gets `created_at`, `updated_at` (managed by Prisma `@updatedAt`).
- All user-facing deletes are soft (`deleted_at` or `status` flag).
- `organization_id` is on every business entity for future multi-tenant isolation. In v1, every row references the single seeded organization.
- Audit log uses `old_value` / `new_value` as TEXT (JSON-serialized for complex fields).

### Tables

#### `organizations`
Future-proofs multi-tenancy. V1 has exactly one row seeded.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| name | VARCHAR(255) | NOT NULL |
| created_at | DATETIME | NOT NULL |
| updated_at | DATETIME | NOT NULL |

#### `users`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INT | PK, AUTO_INCREMENT | |
| organization_id | INT | FK → organizations.id, NOT NULL | |
| username | VARCHAR(100) | UNIQUE per org, NOT NULL | |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt |
| role | ENUM('admin','moderator') | NOT NULL | |
| can_edit | BOOLEAN | NOT NULL, DEFAULT TRUE | Admin toggle |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Soft disable |
| created_at | DATETIME | NOT NULL | |
| updated_at | DATETIME | NOT NULL | |

Indexes: `(organization_id, username)` UNIQUE — enforces uniqueness within org.

#### `invite_tokens`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INT | PK, AUTO_INCREMENT | |
| organization_id | INT | FK → organizations.id, NOT NULL | |
| token_hash | VARCHAR(255) | UNIQUE, NOT NULL | SHA-256 of raw token |
| role | ENUM('admin','moderator') | NOT NULL | |
| created_by_id | INT | FK → users.id, NOT NULL | |
| expires_at | DATETIME | NOT NULL | e.g. +48h from creation |
| used_at | DATETIME | NULL | Set on registration |
| created_at | DATETIME | NOT NULL | |

#### `products`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INT | PK, AUTO_INCREMENT | |
| organization_id | INT | FK → organizations.id, NOT NULL | |
| name | VARCHAR(255) | NOT NULL | |
| price | DECIMAL(10,2) | NOT NULL | Snapshot price at entry time |
| status | ENUM('active','inactive') | NOT NULL, DEFAULT 'active' | |
| created_at | DATETIME | NOT NULL | |
| updated_at | DATETIME | NOT NULL | |

Note: Sales rows store `price_snapshot` — the product price captured at row creation — so changing a product's price never affects historical rows.

#### `mops` (modes of payment)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INT | PK, AUTO_INCREMENT | |
| organization_id | INT | FK → organizations.id, NOT NULL | |
| name | VARCHAR(255) | NOT NULL | |
| status | ENUM('active','inactive') | NOT NULL, DEFAULT 'active' | |
| created_at | DATETIME | NOT NULL | |
| updated_at | DATETIME | NOT NULL | |

#### `sales`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INT | PK, AUTO_INCREMENT | |
| organization_id | INT | FK → organizations.id, NOT NULL | |
| product_id | INT | FK → products.id, NOT NULL | Retained even if product deactivated |
| price_snapshot | DECIMAL(10,2) | NOT NULL | Copied from product.price at creation |
| mop_id | INT | FK → mops.id, NOT NULL | Retained even if MOP deactivated |
| receiver | VARCHAR(255) | NOT NULL | |
| notes | TEXT | NULL | |
| status | ENUM('active','void') | NOT NULL, DEFAULT 'active' | Soft delete via void |
| created_by_id | INT | FK → users.id, NOT NULL | Row owner |
| last_edited_by_id | INT | FK → users.id, NULL | Updated on every save |
| created_at | DATETIME | NOT NULL | |
| updated_at | DATETIME | NOT NULL | "Date Edited" in UI |

Indexes:
- `(organization_id, status)` — admin filtered views
- `(organization_id, created_by_id)` — moderator's own rows
- `(organization_id, product_id)` — filter by product
- `(organization_id, mop_id)` — filter by MOP
- `(organization_id, created_at)` — date range filter, ORDER BY newest first

#### `audit_log`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | BIGINT | PK, AUTO_INCREMENT | High volume — BIGINT |
| organization_id | INT | FK → organizations.id, NOT NULL | |
| user_id | INT | FK → users.id, NOT NULL | Who made the change |
| table_name | VARCHAR(100) | NOT NULL | e.g. 'sales', 'users' |
| row_id | INT | NOT NULL | PK of the changed row |
| action | ENUM('create','update','void') | NOT NULL | |
| field_name | VARCHAR(100) | NULL | NULL for 'create' action |
| old_value | TEXT | NULL | JSON string or scalar |
| new_value | TEXT | NULL | JSON string or scalar |
| created_at | DATETIME | NOT NULL | Immutable — no updated_at |

Indexes:
- `(organization_id, table_name, row_id)` — per-row audit trail lookup
- `(organization_id, user_id)` — per-user activity
- `(organization_id, created_at)` — global log time-ordered

Design note: One audit_log row per changed field per save operation. A single sales edit touching three fields produces three audit_log rows, all with the same timestamp and user, making diffs readable per field. The `action='create'` row has NULL field_name and stores the full initial state as JSON in `new_value`.

### ERD Relationships

```
organizations ──< users
organizations ──< invite_tokens
organizations ──< products
organizations ──< mops
organizations ──< sales
organizations ──< audit_log

users ──< sales (created_by_id)
users ──< sales (last_edited_by_id)
users ──< invite_tokens (created_by_id)
users ──< audit_log (user_id)

products ──< sales (product_id)
mops     ──< sales (mop_id)
```

### Prisma Schema Sketch

```prisma
model Organization {
  id        Int      @id @default(autoincrement())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users        User[]
  products     Product[]
  mops         Mop[]
  sales        Sale[]
  auditLogs    AuditLog[]
  inviteTokens InviteToken[]
}

model User {
  id             Int          @id @default(autoincrement())
  organizationId Int
  organization   Organization @relation(fields: [organizationId], references: [id])
  username       String
  passwordHash   String
  role           Role
  canEdit        Boolean      @default(true)
  isActive       Boolean      @default(true)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  salesCreated   Sale[]       @relation("CreatedBy")
  salesEdited    Sale[]       @relation("LastEditedBy")
  auditLogs      AuditLog[]
  inviteTokens   InviteToken[]

  @@unique([organizationId, username])
}

enum Role { admin moderator }

model Sale {
  id              Int          @id @default(autoincrement())
  organizationId  Int
  organization    Organization @relation(fields: [organizationId], references: [id])
  productId       Int
  product         Product      @relation(fields: [productId], references: [id])
  priceSnapshot   Decimal      @db.Decimal(10, 2)
  mopId           Int
  mop             Mop          @relation(fields: [mopId], references: [id])
  receiver        String
  notes           String?
  status          SaleStatus   @default(active)
  createdById     Int
  createdBy       User         @relation("CreatedBy", fields: [createdById], references: [id])
  lastEditedById  Int?
  lastEditedBy    User?        @relation("LastEditedBy", fields: [lastEditedById], references: [id])
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}

enum SaleStatus { active void }

model AuditLog {
  id             BigInt       @id @default(autoincrement())
  organizationId Int
  organization   Organization @relation(fields: [organizationId], references: [id])
  userId         Int
  user           User         @relation(fields: [userId], references: [id])
  tableName      String
  rowId          Int
  action         AuditAction
  fieldName      String?
  oldValue       String?
  newValue       String?
  createdAt      DateTime     @default(now())
}

enum AuditAction { create update void }
```

---

## API Design

### Protocol Choice: REST

**Recommendation: REST over GraphQL.**

Rationale: This is a CRUD-heavy internal tool with well-defined resources. REST maps cleanly to the entity model. GraphQL's flexibility (nested queries, partial fetches) adds schema maintenance overhead that is not justified when the client and server are co-developed and the data shape is predictable. REST is simpler to secure, easier to test, and aligns with the team's likely experience level.

### Response Envelope

All responses use a consistent shape:

```json
// Success
{
  "success": true,
  "data": { ... }
}

// Success, list
{
  "success": true,
  "data": [ ... ],
  "meta": { "total": 142 }
}

// Error
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to edit this row."
  }
}
```

### Endpoint Map

```
Auth
  POST   /api/auth/login               Login, returns JWT cookie
  POST   /api/auth/logout              Clears cookie
  GET    /api/auth/invite/:token        Validate invite token (for registration page)
  POST   /api/auth/register             Complete registration with invite token

Users (admin only)
  GET    /api/users                    List all users in org
  POST   /api/users/invite             Generate invite link
  PATCH  /api/users/:id                Update username, toggle can_edit
  POST   /api/users/:id/reset-password  Admin resets a user's password

Sales
  GET    /api/sales                    List sales (scoped by role)
                                       ?status=active|void|all
                                       ?created_by=:userId
                                       ?product_id=:id
                                       ?mop_id=:id
                                       ?from=ISO&to=ISO
  POST   /api/sales                    Create new row
  PATCH  /api/sales/:id                Update one or more fields
  POST   /api/sales/:id/void           Soft-delete (void) a row

Products (admin CRUD, moderators GET active only)
  GET    /api/products                 List products (?status=active|inactive|all)
  POST   /api/products                 Create
  PATCH  /api/products/:id             Update name, price, status

MOPs (admin CRUD, moderators GET active only)
  GET    /api/mops                     List MOPs (?status=active|inactive|all)
  POST   /api/mops                     Create
  PATCH  /api/mops/:id                 Update name, status

Audit Log (admin only)
  GET    /api/audit                    Global audit log (?table=sales&row_id=:id)
  GET    /api/audit/sales/:id          All audit entries for a specific sale

Admin — Reports (admin only)
  GET    /api/reports/summary          Aggregated totals (count, revenue, by product, by MOP)
  GET    /api/reports/export           CSV download of filtered sales
```

### HTTP Method Conventions

- `GET` — read-only, never mutates
- `POST` — create new resource or trigger action (void, reset-password, export)
- `PATCH` — partial update (only send changed fields)
- No `PUT` or `DELETE` — PUT is redundant given PATCH; DELETE is avoided given soft-delete policy

### Versioning

Prefix all routes `/api/` (not `/api/v1/`). For an internal tool at this scale, URL versioning adds noise without benefit. If breaking changes are needed, they'll arrive during a major rebuild, not an incremental endpoint change.

---

## RBAC Pattern

### JWT Payload

```json
{
  "sub": 7,
  "role": "moderator",
  "orgId": 1,
  "canEdit": true,
  "iat": 1718500000,
  "exp": 1718586400
}
```

Including `canEdit` in the JWT avoids a DB lookup on every request. The tradeoff: if an admin revokes edit rights, the change takes effect only when the token is re-issued. Acceptable for an internal tool. Mitigate by using short-lived tokens (24h) or by adding a `jti` (token ID) blacklist in Redis/DB if the revocation lag is unacceptable.

### Middleware Stack

```typescript
// middleware/authenticate.ts
// Reads JWT from httpOnly cookie, verifies signature, attaches req.user
export const authenticate = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED' } });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, error: { code: 'TOKEN_INVALID' } });
  }
};

// middleware/authorize.ts
// Role check — use as route-level middleware after authenticate
export const requireRole = (...roles: Role[]) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
  }
  next();
};

// middleware/requireEditRights.ts
// Checks can_edit flag AND row ownership for moderators
export const requireEditRights = async (req, res, next) => {
  const { user } = req;
  if (user.role === 'admin') return next(); // admins bypass
  if (!user.canEdit) {
    return res.status(403).json({ success: false, error: { code: 'EDIT_RIGHTS_REVOKED' } });
  }
  // Ownership check: moderator can only edit their own rows
  const sale = await prisma.sale.findUnique({ where: { id: Number(req.params.id) } });
  if (!sale || sale.createdById !== user.sub) {
    return res.status(403).json({ success: false, error: { code: 'NOT_ROW_OWNER' } });
  }
  next();
};
```

### Route-Level Application

```typescript
// routes/sales.routes.ts
router.get('/', authenticate, salesController.list);
router.post('/', authenticate, salesController.create);
router.patch('/:id', authenticate, requireEditRights, salesController.update);
router.post('/:id/void', authenticate, requireEditRights, salesController.void);

// routes/users.routes.ts
router.get('/', authenticate, requireRole('admin'), usersController.list);
router.post('/invite', authenticate, requireRole('admin'), usersController.invite);
```

### Enforcement Summary

| Action | Who | Check |
|--------|-----|-------|
| View own sales | Moderator | authenticate + query filter by createdById |
| View all sales | Admin | authenticate + requireRole('admin') |
| Create row | Any authenticated | authenticate |
| Edit row | Moderator (own rows, if can_edit=true) | authenticate + requireEditRights |
| Edit any row | Admin | authenticate (admin bypasses in requireEditRights) |
| Void row | Same as edit | authenticate + requireEditRights |
| Manage users/products/MOPs | Admin only | authenticate + requireRole('admin') |
| View audit log | Admin only | authenticate + requireRole('admin') |

---

## Audit Log Design

### Write Pattern

Audit writes happen inside the same Prisma transaction as the data mutation. This guarantees that the audit log is always consistent with the data — no mutation without an audit record, no orphaned audit records.

```typescript
// services/sales.service.ts — updateSale()
async function updateSale(saleId: number, userId: number, updates: Partial<SaleFields>) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.sale.findUniqueOrThrow({ where: { id: saleId } });

    const updated = await tx.sale.update({
      where: { id: saleId },
      data: { ...updates, lastEditedById: userId, updatedAt: new Date() },
    });

    // One audit_log row per changed field
    const auditRows = Object.entries(updates)
      .filter(([field, newVal]) => String(current[field]) !== String(newVal))
      .map(([field, newVal]) => ({
        organizationId: current.organizationId,
        userId,
        tableName: 'sales',
        rowId: saleId,
        action: 'update' as const,
        fieldName: field,
        oldValue: String(current[field] ?? ''),
        newValue: String(newVal ?? ''),
      }));

    if (auditRows.length > 0) {
      await tx.auditLog.createMany({ data: auditRows });
    }

    return updated;
  });
}

// On creation: single audit_log row with action='create', fieldName=null,
// newValue = JSON.stringify(entire row)
async function createSale(data: CreateSaleInput, userId: number) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUniqueOrThrow({ where: { id: data.productId } });

    const sale = await tx.sale.create({
      data: { ...data, priceSnapshot: product.price, createdById: userId },
    });

    await tx.auditLog.create({
      data: {
        organizationId: sale.organizationId,
        userId,
        tableName: 'sales',
        rowId: sale.id,
        action: 'create',
        fieldName: null,
        oldValue: null,
        newValue: JSON.stringify(sale),
      },
    });

    return sale;
  });
}
```

### Void Pattern

```typescript
async function voidSale(saleId: number, userId: number) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.update({
      where: { id: saleId },
      data: { status: 'void', lastEditedById: userId },
    });

    await tx.auditLog.create({
      data: {
        organizationId: sale.organizationId,
        userId,
        tableName: 'sales',
        rowId: saleId,
        action: 'void',
        fieldName: 'status',
        oldValue: 'active',
        newValue: 'void',
      },
    });

    return sale;
  });
}
```

### Reading the Audit Trail

For the admin's per-row audit drawer, fetch all audit_log rows for a given (table_name, row_id) ordered by created_at ASC. Group by timestamp to show "edit sessions" (multiple fields changed at once are grouped by matching created_at + user_id).

---

## Optimistic UI Updates (React)

### Pattern: TanStack Query `useMutation` with `onMutate` / `onError`

TanStack Query (React Query) is the standard for this. The flow:

1. `onMutate` — called before the API request fires. Snapshot current cache, inject optimistic value.
2. `onError` — roll back to snapshot.
3. `onSettled` — always invalidate the query to sync with server truth.

```typescript
// hooks/useSales.ts
const useUpdateSaleCell = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ saleId, field, value }) =>
      salesApi.patch(saleId, { [field]: value }),

    onMutate: async ({ saleId, field, value }) => {
      // Cancel any in-flight refetch
      await queryClient.cancelQueries({ queryKey: ['sales'] });

      // Snapshot previous state
      const previous = queryClient.getQueryData(['sales']);

      // Optimistically update the cache
      queryClient.setQueryData(['sales'], (old) =>
        old.map((row) => row.id === saleId ? { ...row, [field]: value } : row)
      );

      return { previous }; // context for rollback
    },

    onError: (_err, _vars, context) => {
      // Roll back
      queryClient.setQueryData(['sales'], context.previous);
      // Show error on the cell (handled by mutation.isError in component)
    },

    onSettled: () => {
      // Always refetch to ensure server truth
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
  });
};
```

### EditableCell Component Behavior

```
Cell is in "view" mode (displays value)
  │
  ▼ user clicks cell
Cell switches to "edit" mode (input appears, value pre-filled)
  │
  ▼ user types and presses Enter or tabs away (onBlur)
  ├── if value unchanged → revert to view mode, no API call
  └── if value changed:
      ├── fire mutation (optimistic update triggers immediately)
      ├── cell reverts to view mode showing new value
      └── on error: cell shows error state, re-enters edit mode
```

### Concurrency Note

For a small team (handful of users), the naive approach is fine: last write wins. If two moderators edit the same row simultaneously, the second PATCH overwrites the first. The audit log preserves both versions. Optimistic locking (sending `updatedAt` and checking server-side) can be added in v2 if conflicts become a problem.

---

## Build Order

Build order follows hard dependency edges: nothing can be built until what it depends on exists.

### Dependency Graph

```
[1] Database Schema + Prisma Setup
        │
        ▼
[2] Auth System (users table, JWT, login/logout, invite flow)
        │
        ├──▶ [3a] Products & MOPs CRUD (admin)
        │         │
        │         └──▶ [4] Sales CRUD + Audit Log (depends on products, MOPs, users)
        │                   │
        │                   └──▶ [5] Sales Sheet UI (depends on sales API + products/MOPs API)
        │
        ├──▶ [3b] User Management UI (depends on auth + invite API)
        │
        └──▶ [6] Admin Dashboard (depends on sales data + reports API)
                  │
                  └──▶ [7] Audit Log Viewer UI (depends on audit_log data)
```

### Suggested Phase Sequence

| Phase | What to Build | Why First |
|-------|--------------|-----------|
| 1 | Repo setup, Prisma schema, DB migrations, seed org+admin | Everything else needs the schema |
| 2 | Express auth: login, JWT, cookie, logout, invite token flow, register | Every API route needs authentication |
| 3 | Products API + MOPs API (CRUD, status toggle) | Sales rows reference products/MOPs; needed before sales |
| 4 | Sales API: create, list, patch (with RBAC + audit log inside transaction) | Core domain logic |
| 5 | React: Auth pages (login, register via invite) + route guards + API client | Frontend gate before any other UI |
| 6 | React: Sales Sheet (virtual scroll, inline editing, add row, optimistic updates) | Core moderator workflow |
| 7 | React: Admin Dashboard (all-sales view, filters, charts, CSV export) | Depends on complete sales data |
| 8 | React: Admin management UIs (users, products, MOPs, audit log viewer) | Admin workflow, depends on APIs from phases 2-4 |

### Critical Path

```
Schema → Auth API → Products/MOPs API → Sales API → React Sales Sheet
```

The React sales sheet is the last unblocked piece because it needs:
- Auth (to know who the user is)
- Products API (for the product combobox)
- MOPs API (for the MOP combobox)
- Sales API (to create/read/update rows)

Admin UI phases (7 and 8) can proceed in parallel once the sales API exists, since they are read-heavy with no new backend dependencies.

### What NOT to Build Early

- Reports / CSV export — defer until sales data flows correctly end-to-end
- Virtual scroll — implement after the basic table renders correctly; virtual scroll is a UI optimization layer
- Dashboard charts — last; depends on having real aggregated data to validate against

---

## Key Architectural Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Repo structure | Monorepo, npm workspaces | Single team, simpler deployment |
| API style | REST with JSON envelope | CRUD-heavy, predictable shape, no GraphQL overhead |
| Auth mechanism | JWT in httpOnly cookie | Secure (no XSS token theft), persists across browser restarts |
| Token storage | httpOnly cookie, NOT localStorage | localStorage is XSS-vulnerable; httpOnly cookie is inaccessible to JS |
| Session persistence | Long-lived JWT (7-14 days) + re-login on expiry | "Persist until logout" requirement; no refresh token complexity needed |
| Invite tokens | crypto.randomBytes(32) raw token, SHA-256 hash stored in DB | Prevents rainbow-table attacks on token column if DB is compromised |
| Audit log writes | Inside same Prisma transaction as mutation | Guarantees consistency — impossible to mutate without logging |
| Audit log granularity | One row per field per save | Enables per-field diff rendering in the admin audit viewer |
| Optimistic updates | TanStack Query onMutate/onError pattern | Spreadsheet-like feel; instant feedback, clean rollback |
| Price locking | Copy product.price to sale.price_snapshot at creation | Product price changes never affect historical sales rows |
| Multi-tenant readiness | organization_id on all business tables in v1 schema | Zero schema migration cost when multi-tenant is added in v2 |
| Soft delete | `status = 'void'` on sales; `is_active = false` on users | Full auditability; data never lost |

---

*Confidence: HIGH — React, Express, Prisma, MySQL, JWT, and TanStack Query are well-documented, stable technologies with established patterns. No experimental or emerging tech is used. All patterns above reflect industry-standard approaches for internal CRUD tools of this complexity level.*
