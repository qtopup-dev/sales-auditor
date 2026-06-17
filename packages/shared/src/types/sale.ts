// API response shape for Sale entity
// Note: productNameSnapshot and mopNameSnapshot are denormalized columns that MUST be added
// to the Prisma schema in plan 03. These satisfy CLAUDE.md Rule 4 (never join to products
// for display price/name on historical rows). Cross-plan dependency: plan 03 schema must
// include these columns on the Sale model.
// Security: T-02-02 — priceSnapshot typed as string prevents float precision loss

export type SaleStatus = 'active' | 'void';

export interface Sale {
  id: number;                       // INT AUTO_INCREMENT (D-01)
  organizationId: number;           // Required on every business entity (CLAUDE.md Rule 5)
  productId: number;
  productNameSnapshot: string;      // Denormalized at creation — never join to products for display (CLAUDE.md Rule 4)
  priceSnapshot: string;            // DECIMAL(10,2) returned as string (CLAUDE.md Rule 6)
  mopId: number;
  mopNameSnapshot: string;          // Denormalized at creation — never join to mops for display
  receiver: string;
  notes: string | null;
  status: SaleStatus;               // Soft-delete field (CLAUDE.md Rule 3)
  createdById: number;
  createdByUsername: string;        // Denormalized for display — avoid join on list view
  lastEditedById: number | null;
  lastEditedByUsername: string | null;
  createdAt: string;                // ISO 8601 UTC string
  updatedAt: string;
}
