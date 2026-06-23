// API response shape for AuditLog entity
// Note: AuditLog.id is BigInt in the database. It is serialized as string in the API
// response (CR-02 fix). Number(bigint) silently truncates above 2^53-1; String() is safe.
// The key={entry.id} usage in AuditDrawer accepts string without change.

export type AuditAction = 'create' | 'update' | 'void';

export interface AuditEntry {
  id: string;                // BigInt in DB — serialized as string for API (CR-02: prevents Number truncation above 2^53)
  organizationId: number;
  userId: number;
  userUsername: string;      // Denormalized for display in audit drawer
  saleId: number | null;
  tableName: string;
  rowId: number;
  action: AuditAction;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;         // ISO 8601 UTC string
}
