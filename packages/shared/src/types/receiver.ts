// API response shape for Receiver entity
// Phase 5: replaces free-text sale.receiver with FK to receivers catalog

export interface Receiver {
  id: number;
  organizationId: number;
  name: string;
  accountNumber: string | null;
  isActive: boolean;
  createdAt: string;  // ISO 8601 UTC string
  updatedAt: string;
}
