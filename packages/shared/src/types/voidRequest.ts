// API response shape for VoidRequest entity — Phase 12 moderator void-request workflow.
// `sale` on the enriched VoidRequestWithSale variant is the full snapshot-bearing sale row
// so the admin table never re-joins products/mops/receivers for display (CLAUDE.md Rule 4).

import type { Sale } from './sale.js';

export type VoidRequestStatus = 'pending' | 'approved' | 'rejected';

export interface VoidRequest {
  id: number;
  organizationId: number;
  saleId: number;
  reason: string;
  status: VoidRequestStatus;
  requestedById: number;
  requestedByUsername: string;
  reviewedById: number | null;
  reviewedByUsername: string | null;
  reviewedAt: string | null; // ISO 8601 UTC string
  createdAt: string;         // ISO 8601 UTC string
  updatedAt: string;         // ISO 8601 UTC string
}

// Extended shape returned by GET /api/void-requests and the approve/reject endpoints —
// embeds the full sale row so the admin table renders it without a second round trip.
export interface VoidRequestWithSale extends VoidRequest {
  sale: Sale;
}
