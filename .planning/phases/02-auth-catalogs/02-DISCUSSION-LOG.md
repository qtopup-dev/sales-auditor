# Phase 2: Auth + Catalogs - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-17
**Phase:** 02-auth-catalogs
**Areas discussed:** Password Reset UX, Admin Navigation Layout, Catalog Management UI, Post-Login Routing + Auth Guards

---

## Password Reset UX

| Option | Description | Selected |
|--------|-------------|----------|
| Generate + display a temp password | Backend generates random password, returns plaintext once, admin shares verbally | ✓ |
| Generate a one-time reset link | Reuses InviteToken flow, mod visits /reset/:token to set their own password | |
| Admin sets the new password directly | Admin types the new password into a form field | |

**User's choice:** Generate + display a temp password

---

| Option | Description | Selected |
|--------|-------------|----------|
| Keep it indefinitely (no forced change) | Temp password becomes their actual password; no mustChangePassword flag | ✓ |
| Force change on next login | Requires mustChangePassword boolean on User model, forced redirect, change-password page | |

**User's choice:** Keep it indefinitely (no forced change)

**Notes:** Simple approach — no schema changes needed for password reset flow. Temp password is bcrypt-hashed (cost 12) and stored. Admin receives plaintext once per API response.

---

## Admin Navigation Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar navigation | Persistent left sidebar. Classic admin panel. One layout component, role-based nav items. | ✓ |
| Top navigation bar | Horizontal nav links in a header | |
| Tabs within a single page | Tabbed layout inside one route | |

**User's choice:** Sidebar navigation

---

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard, Products, MOPs, Users (admin) | Dashboard is placeholder in Phase 2; expanded in Phase 4 | ✓ |
| Sales View, Products, MOPs, Users (admin) | Uses "Sales View" as root label instead of "Dashboard" | |

**User's choice:** Dashboard, Products, MOPs, Users — Dashboard is Phase 2 placeholder

---

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal header with username + Logout only (moderator) | No sidebar for mods — just a top bar | |
| Same sidebar, fewer items (moderator) | Sidebar exists for mods with "Sales Sheet" as the only item | ✓ |

**User's choice:** Same sidebar, fewer items — one AuthenticatedLayout component for all roles

---

## Catalog Management UI

| Option | Description | Selected |
|--------|-------------|----------|
| Table + modal form | Read-only table + Add button opens modal. Edit button per row opens pre-filled modal. | ✓ |
| Table with inline editing | Click cell to edit in place (like Phase 3 sales sheet) | |
| Dedicated form page per item | Each product/MOP gets its own /edit route | |

**User's choice:** Table + modal form

---

| Option | Description | Selected |
|--------|-------------|----------|
| Name \| Price (products only) \| Status badge \| Actions | Status as colored badge, Actions column with Edit + Toggle buttons | ✓ |
| Name \| Price (products only) \| Active toggle switch \| Edit button | Inline toggle switch instead of badge + button | |

**User's choice:** Name | Price (products only) | Status badge | Actions

---

## Post-Login Routing + Auth Guards

| Option | Description | Selected |
|--------|-------------|----------|
| Admin → /dashboard, Moderator → /sales | Role-based redirect on login. Backend returns role in login response. | ✓ |
| Everyone → /sales, admin gets a nav link to /dashboard | Single landing page, admin navigates to dashboard manually | |

**User's choice:** Admin → /dashboard, Moderator → /sales

---

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect back to original URL (returnTo) | Store attempted URL, redirect back after login | ✓ |
| Always redirect to role-based default | Ignore original URL, always land on role default | |

**User's choice:** returnTo pattern — stored in React Router location state (no server-side storage needed, no open redirect risk)

---

## Claude's Discretion

- CSS styling for sidebar (Tailwind utility classes)
- Login form error message copy (generic "Invalid credentials")
- Modal component structure
- Password minimum length (8 characters)
- Temp password format (crypto.randomBytes based, 12 chars URL-safe)
- API route naming within REST conventions

## Deferred Ideas

- Brute-force/rate-limit protection on login — v2 requirement, do not add in Phase 2
- mustChangePassword flow — not needed per D-02
- Email delivery for invites or resets — v1 out of scope
- Multiple admin accounts with distinct permission levels — v2
- "Remember me" toggle — not needed (rolling 30-day session covers AUTH-02)
