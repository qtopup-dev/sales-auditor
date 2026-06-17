// API response shape for Product entity
// Security: T-02-02 — price typed as string prevents float precision loss on monetary values

export interface Product {
  id: number;                // INT AUTO_INCREMENT (D-01)
  organizationId: number;    // Required on every business entity (CLAUDE.md Rule 5)
  name: string;
  price: string;             // DECIMAL(10,2) returned as string (CLAUDE.md Rule 6)
  isActive: boolean;         // Soft-delete field (CLAUDE.md Rule 3)
  createdAt: string;         // ISO 8601 UTC string
  updatedAt: string;
}
