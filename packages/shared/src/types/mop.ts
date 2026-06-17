// API response shape for MOP (Method of Payment) entity

export interface Mop {
  id: number;                // INT AUTO_INCREMENT (D-01)
  organizationId: number;    // Required on every business entity (CLAUDE.md Rule 5)
  name: string;
  isActive: boolean;         // Soft-delete field (CLAUDE.md Rule 3)
  createdAt: string;         // ISO 8601 UTC string
  updatedAt: string;
}
