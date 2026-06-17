// API response shape for User entity
// Note: passwordHash is NEVER included in API responses — omitted here intentionally
// Security: T-02-01 — User interface structurally prevents passwordHash from appearing in HTTP responses

export type Role = 'admin' | 'moderator';

export interface User {
  id: number;                // INT AUTO_INCREMENT (D-01)
  organizationId: number;    // Required on every business entity (CLAUDE.md Rule 5)
  username: string;
  role: Role;
  canEdit: boolean;
  isActive: boolean;         // Soft-delete field (CLAUDE.md Rule 3)
  createdAt: string;         // ISO 8601 UTC string — never Date object across HTTP
  updatedAt: string;
}

export interface Organization {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}
