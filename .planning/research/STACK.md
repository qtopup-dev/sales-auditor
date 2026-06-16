# Stack Research — Sales Auditing Web App

**Project:** Sales Auditing Web App
**Researched:** 2026-06-16
**Research basis:** Training knowledge through August 2025. External verification tools (WebSearch, WebFetch, Bash/Context7 CLI) were unavailable in this environment. Versions marked [VERIFY] must be confirmed against npm or official docs before pinning in package.json.

---

## Recommended Stack (2025)

### Frontend

| Library | Version | Purpose | Rationale |
|---------|---------|---------|-----------|
| React | ^18.3 | UI framework | Fixed by constraint. React 18 concurrent features (useDeferredValue, useTransition) help with large table re-renders. [VERIFY: React 19 stable status] |
| Vite | ^5.x | Build tool / dev server | Fastest dev-server HMR available; standard replacement for CRA as of 2023, universally adopted by 2025. No meaningful alternative for this stack. |
| TypeScript | ^5.x | Type safety | Pairs with Prisma's generated types end-to-end. Catches column/field mismatches at compile time, critical for an auditing app where field correctness matters. |
| @tanstack/react-table | ^8.x | Spreadsheet-like table | See detailed rationale below. |
| @tanstack/react-virtual | ^3.x | Virtual scroll | See detailed rationale below. |
| react-select | ^5.x | Searchable combo box | See detailed rationale below. |
| recharts | ^2.x | Dashboard charts | See detailed rationale below. |
| axios | ^1.x | HTTP client | Simpler API than raw fetch for interceptors (needed for session 401 handling); well-typed with TypeScript. Alternative: native fetch is viable but needs manual wrapper for error handling. |
| react-router-dom | ^6.x | Client-side routing | Industry standard; v6 data router API reduces boilerplate for protected routes. |
| react-hook-form | ^7.x | Form state management | Minimal re-renders, built-in validation, works cleanly with controlled inline cell editors. Alternative: Formik is heavier with no meaningful benefit here. |
| date-fns | ^3.x | Date formatting | Tree-shakeable, no prototype pollution (unlike moment.js), covers all date display/formatting needs for the audit log and timestamp columns. |
| tailwindcss | ^3.x | Utility CSS | Fast iteration on table/dashboard layouts. No design system needed for an internal tool — utility classes are sufficient and faster than a component library. [VERIFY: Tailwind v4 stable status] |

**Table Library Decision — @tanstack/react-table v8**

This project requires: inline cell editing, virtual scroll integration, no-pagination (all rows in DOM via virtual list), column-level control (locked price column, combo box cells, strikethrough voided rows), and a spreadsheet feel.

TanStack Table v8 is headless — it provides logic (sorting, filtering, row state, cell context) without imposing markup or styles. This is the correct fit because:
- Inline editing requires custom cell renderers, which headless enables cleanly
- Virtual scroll integrates via @tanstack/react-virtual in the same ecosystem (shared row measurement)
- The locked price column is simply a `meta.editable: false` cell config
- No bundle penalty from unused features (unlike AG Grid Community)

AG Grid Community is an alternative but brings ~600 KB, opinionated CSS, and a learning curve that isn't justified for an internal app with a small team.

**Virtual Scroll — @tanstack/react-virtual v3**

Use @tanstack/react-virtual (not react-window). Reasons:
- Same TanStack ecosystem as the table — shared row models avoid double-measuring
- v3 supports dynamic row heights, which matters when cells wrap (Notes column)
- react-window is older, has no active development as of 2025, and lacks dynamic height support without react-window-infinite-loader hacks
- react-virtuoso is a viable alternative but adds a dependency with no benefit when already using TanStack Table

**Combo Box — react-select v5**

For Product and Mode of Payment columns (searchable, dropdown from API-loaded list):
- react-select v5 has full TypeScript support, controlled mode, async option loading, and a well-understood API
- Headless UI Combobox (from @headlessui/react) is viable if already using Tailwind, but requires building the option list rendering manually — more work for the same result
- Downshift is lower-level still and requires more custom code; correct choice for a design system, overkill here
- react-select integrates directly into react-hook-form via Controller, which this stack already uses

**Charts — Recharts v2**

For the admin dashboard (sales count, revenue, product breakdown, payment method breakdown, trends):
- Recharts is built on D3 but exposes a declarative React component API; no D3 knowledge needed
- Maintained actively; ~500 KB but tree-shakeable
- Chart.js + react-chartjs-2 is a viable alternative; similar bundle size; less idiomatic React (imperative ref-based updates)
- Victory and Nivo are heavier and styled toward data viz products, not simple internal dashboards
- For this app's needs (bar, line, pie charts), Recharts covers everything with simpler code

---

### Backend

| Library | Version | Purpose | Rationale |
|---------|---------|---------|-----------|
| express | ^4.x | HTTP framework | Fixed by constraint. Express 4 is stable and well-understood; Express 5 (RC) is not production-ready as of mid-2025. [VERIFY: Express 5 stable release] |
| express-session | ^1.x | Session management | See auth section. |
| connect-mysql2 | or equivalent | Session store | Persists sessions to MySQL so they survive server restarts on VPS. Required for production. |
| bcrypt | ^5.x | Password hashing | Industry standard; bcryptjs (pure JS) is the fallback if native bindings fail on VPS, but bcrypt (native) is faster and preferred. |
| helmet | ^8.x | Security headers | Sets Content-Security-Policy, X-Frame-Options, HSTS, etc. One middleware call, zero configuration needed for a basic internal app. Ship from day one. |
| cors | ^2.x | CORS policy | Control which origins can call the API. Even for same-origin VPS deployment, explicit CORS config prevents accidental open policy. |
| express-rate-limit | ^7.x | Rate limiting | Deferred to v2 per PROJECT.md, but install from the start — it's one line to enable and zero overhead when inactive. |
| express-validator | ^7.x | Input validation | Validate and sanitize all incoming API payloads. Prevents bad data entering the audit log. |
| json2csv | ^6.x | CSV export | See CSV section. |
| morgan | ^1.x | HTTP request logging | Development and production access logs. Essential for debugging on a VPS where you can't attach a debugger easily. |
| dotenv | ^16.x | Environment config | `.env` for secrets (DB credentials, session secret). Standard practice. |

---

### Database / ORM

**Recommendation: Prisma — CONFIRMED**

The architect's recommendation is correct. Prisma is the right ORM for this project. Here is the reasoning against each alternative:

**Prisma strengths for this project:**

1. **Type-safe query builder with generated client.** Because the project uses TypeScript end-to-end, Prisma generates a fully-typed client from the schema. Any column rename or table change surfaces as a compile error, not a runtime crash — critical for an audit trail app where field names in the log must match actual columns.

2. **Migration workflow.** `prisma migrate dev` / `prisma migrate deploy` provides a reproducible, version-controlled migration history. For a schema that needs to evolve toward multi-tenant in v2, having structured migration files is essential. Raw SQL migrations are error-prone without tooling.

3. **Prisma Schema as single source of truth.** The schema file documents the database structure clearly, making it easier for the admin dashboard's audit log queries to stay in sync with the actual schema.

4. **MySQL support is first-class.** Prisma has had mature MySQL support since v3. There are no known blockers for this use case.

5. **Soft-delete pattern.** Prisma middleware can intercept all `findMany`/`findFirst` calls to automatically exclude `deletedAt IS NOT NULL` rows, enforcing the soft-delete policy at the ORM layer.

**Alternatives and why they are not recommended:**

| ORM | Why Not |
|-----|---------|
| **Drizzle ORM** | Excellent type safety and growing fast in 2025, but the migration story (drizzle-kit) is less mature than Prisma's for teams unfamiliar with SQL. Drizzle is SQL-first (you write SQL-like syntax), which is a better fit when the team has strong SQL skills and wants thin abstraction. Prisma's higher-level API is the right trade-off for this team and use case. |
| **TypeORM** | Decorator-based, historically buggy with MySQL, poor TypeScript inference on complex queries, and maintenance has slowed. Not recommended for greenfield in 2025. |
| **Sequelize** | Oldest ORM in the ecosystem. Weak TypeScript support (types are community-maintained and lag behind). No compelling reason to choose it over Prisma in 2025. |
| **Raw mysql2** | No type safety on queries, no migration tooling, high maintenance burden for schema changes. Only justified for ultra-high performance N+1-sensitive workloads, which this app is not. |

**Prisma version to use:** ^5.x (Prisma 5 introduced significant performance improvements to the query engine). [VERIFY current minor version on npmjs.com/package/prisma]

---

### Auth

**Recommendation: express-session + bcrypt (server-side sessions)**

Do NOT use JWTs for this project. Here is why:

**The case against JWT for this app:**

The PROJECT.md requires "Sessions persist until explicit logout" and "Admin can manually reset any user's password." JWTs are stateless — once issued, they cannot be revoked without a server-side blocklist, which defeats the purpose of statelessness and adds complexity. The admin's ability to instantly revoke a moderator's edit rights (toggle) also requires server-side session control.

**The case for express-session:**

- Sessions are stored in MySQL (via `connect-mysql2` or `express-mysql-session`). The server can destroy a session immediately on logout, password reset, or permission revocation.
- `req.session.userId` and `req.session.role` are available in every request handler with no token parsing overhead.
- Admin password reset: invalidate all sessions for the target user by deleting their session records from the session store.
- Invite link flow: generate a short-lived token (stored in DB, not JWT), moderator clicks link, sets password, session begins. Simple.

**Passport.js verdict:** Do not add Passport.js. It adds abstraction that is only valuable when supporting multiple auth strategies (OAuth, SAML, etc.). This app uses username/password only. `passport-local` would just wrap what `express-session` + `bcrypt` already do, adding a dependency with no benefit.

**Implementation pattern:**

```
POST /api/auth/login
  → validate username/password with express-validator
  → find user by username (Prisma)
  → bcrypt.compare(password, user.passwordHash)
  → if match: req.session.userId = user.id, req.session.role = user.role
  → return { id, username, role }

Middleware: requireAuth(req, res, next) → check req.session.userId
Middleware: requireAdmin(req, res, next) → check req.session.role === 'ADMIN'

POST /api/auth/logout → req.session.destroy()
```

**bcrypt cost factor:** 12 rounds. At 12, bcrypt takes ~300ms per hash on modern hardware — secure enough against offline attacks, fast enough that login latency is imperceptible to internal users.

**Session secret:** 32+ byte random string from `crypto.randomBytes(32).toString('hex')`, stored in `.env`, rotated on VPS password change.

---

### CSV Export

**Recommendation: json2csv (or @json2csv/plainjs)**

For the admin dashboard CSV export of filtered sales data:

- `json2csv` v6+ (the `@json2csv/plainjs` package under the new scoped naming) is the most battle-tested Node.js CSV serializer. Handles field flattening, custom headers, and special character escaping correctly.
- The API is simple: `parse(rows, { fields })` returns a CSV string which is streamed via `res.setHeader('Content-Disposition', 'attachment; filename=sales.csv')`.
- `fast-csv` is an alternative with streaming support — useful for very large exports (100K+ rows). For this app's use case (internal tool, small team, filtered result sets), synchronous `json2csv` is simpler and sufficient.
- `papaparse` is a CSV parser (CSV → JS objects), not a serializer. Do not use server-side for generation.

**Pattern:**

```javascript
import { parse } from '@json2csv/plainjs';

router.get('/export', requireAdmin, async (req, res) => {
  const rows = await prisma.sale.findMany({ where: filters, include: { ... } });
  const csv = parse(rows, { fields: ['id', 'product.name', 'price', ...] });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="sales-export.csv"');
  res.send(csv);
});
```

---

### Dev & Build Tooling

| Tool | Version | Purpose | Rationale |
|------|---------|---------|-----------|
| Vite | ^5.x | Frontend build & dev server | Fastest HMR, native ESM, minimal config. Standard for React in 2025. |
| TypeScript | ^5.x | Static typing | End-to-end type safety from Prisma schema to React props. |
| ESLint | ^9.x | Linting | Flat config (eslint.config.js) is now default in v9. Use with `@typescript-eslint/eslint-plugin`. |
| Prettier | ^3.x | Code formatting | Opinionated, no debates about style. |
| tsx | ^4.x | Run TS in Node directly | Used for running Prisma seed scripts and ad-hoc backend scripts without a build step. |
| nodemon | ^3.x | Dev server auto-restart | Standard Express development tool; watches for file changes. Alternatively, tsx --watch covers both. |
| concurrently | ^8.x | Run frontend + backend together | `concurrently "npm run dev:api" "npm run dev:ui"` in a monorepo-lite structure. |

**Project structure recommendation:** Monorepo-lite (single repo, two directories: `/client` and `/server`). Not a full Turborepo/Nx setup — overkill for this project size. Shared types can live in `/shared` and be imported by both sides.

---

## What NOT to Use (and Why)

| Category | Rejected Option | Reason |
|----------|----------------|--------|
| ORM | TypeORM | Buggy MySQL behavior, slow TypeScript inference, declining maintenance in 2025 |
| ORM | Sequelize | Weak TypeScript, legacy design, no advantage over Prisma for greenfield |
| ORM | Raw mysql2 | No type safety, no migrations, high maintenance cost |
| Auth | JWT (jsonwebtoken) | Stateless tokens cannot be revoked; incompatible with "admin can reset any session" requirement |
| Auth | Passport.js | Abstraction with no benefit for single-strategy (local) auth |
| Auth | Auth0 / Clerk | Overkill for internal tool; adds external dependency and cost; username/password-only requirement is simpler without it |
| Table | AG Grid Community | ~600 KB bundle, opinionated styles, licensing risk if Community features are needed from Enterprise tier |
| Table | react-data-grid | Less composable than TanStack; custom cell renderers are harder to integrate with react-hook-form |
| Virtual Scroll | react-window | Unmaintained / stagnant as of 2024-2025; no dynamic row height support |
| Virtual Scroll | react-virtuoso | Viable but redundant when already using @tanstack/react-virtual |
| Charts | Victory | Heavy bundle (~800 KB), better suited for data viz apps than simple dashboards |
| Charts | Nivo | Beautiful but large; SSR-focused features irrelevant here; overkill for 4–5 chart types |
| Charts | D3 directly | Too low-level; Recharts already wraps D3 with a React-idiomatic API |
| Combo Box | Downshift | Too low-level; requires building the entire dropdown UI; correct for design systems, not product features |
| CSV | papaparse (server-side) | papaparse is a parser, not a serializer; wrong tool |
| CSS | MUI / Ant Design / Chakra | Full component libraries add 200-400 KB and enforce design opinions; Tailwind is lighter and more flexible for an internal tool |
| Build | Create React App (CRA) | Deprecated / unmaintained; replaced by Vite |
| Build | Webpack (manual) | No reason to configure manually when Vite handles everything |
| Forms | Formik | Heavier than react-hook-form with no performance advantage; react-hook-form has become the standard |

---

## Confidence Notes

**HIGH confidence (well-established, stable as of training cutoff August 2025):**
- Prisma ORM for MySQL + Node.js: mature, no known blockers, first-class MySQL support confirmed
- express-session + bcrypt for auth: standard pattern, no regressions or replacement emerged
- @tanstack/react-table v8: stable API since 2022, widely adopted
- @tanstack/react-virtual v3: stable, active development
- react-select v5: stable, widely used
- Recharts v2: stable, actively maintained
- json2csv / @json2csv/plainjs: stable serialization library
- helmet + cors + express-rate-limit: standard Express security middleware with no changes
- Vite v5: stable, standard React build tool
- react-hook-form v7: stable

**MEDIUM confidence (should be spot-checked before starting implementation):**
- Express 4 vs Express 5: Express 5 was in RC as of late 2024. If it went stable in early 2025, Express 5 may be the right choice. [VERIFY: https://expressjs.com/en/guide/migrating-5.html]
- Tailwind CSS v4: Tailwind v4 was announced / in alpha-beta as of early 2025. By mid-2025 it may be stable. [VERIFY: https://tailwindcss.com/blog/tailwindcss-v4]
- react-select v5 with React 19 compatibility: If React 19 is used, confirm peer dep compatibility. [VERIFY]
- Prisma v5 minor version: pin to current patch release. [VERIFY: https://www.npmjs.com/package/prisma]

**LOW confidence (requires explicit verification):**
- Exact patch versions of all packages — do not pin from this document; run `npm install [package]@latest` and check output
- connect-mysql2 / express-mysql-session: verify which session store package is actively maintained in 2025 for MySQL; `express-mysql-session` is the canonical one but confirm its last release date
- Whether react-select v5 has been superseded by a v6 release

**What this research could NOT verify (tool restrictions):**
- Any npm package release dates or exact current versions
- Whether any of the recommended libraries have had major breaking changes or deprecation notices since August 2025
- Community sentiment shifts (e.g., if Drizzle ORM has significantly overtaken Prisma in adoption by mid-2026)

**Recommended pre-implementation verification checklist:**
1. `npm info prisma version` — confirm v5.x is current
2. `npm info express version` — confirm v4 or v5 stable
3. `npm info @tanstack/react-table version` — confirm v8.x
4. `npm info @tanstack/react-virtual version` — confirm v3.x
5. `npm info recharts version` — confirm v2.x
6. `npm info react-select version` — confirm v5.x
7. Check https://tailwindcss.com/blog for v4 stable announcement
8. Check https://expressjs.com for v5 stable announcement
9. Verify express-mysql-session last publish date on npmjs.com
