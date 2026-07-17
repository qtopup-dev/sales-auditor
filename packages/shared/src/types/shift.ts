// API response shape for Shift entity — Phase 7 moderator clock in/out tracking
// clockOutAt: null means the shift is still open (moderator is currently clocked in)

export interface Shift {
  id: number;
  organizationId: number;
  userId: number;
  clockInAt: string;   // ISO 8601 UTC string
  clockOutAt: string | null;
  createdAt: string;   // ISO 8601 UTC string
  updatedAt: string;
}

// Extended shape returned by GET /api/shifts/current and GET /api/shifts/history —
// server-computed totals, never float (CLAUDE.md Rule 6)
export interface ShiftWithTotals extends Shift {
  activeSalesCount: number;
  activeSalesRevenue: string; // DECIMAL string, e.g. "150.00"
}
