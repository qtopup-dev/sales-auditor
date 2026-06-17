// API response shape for AuditLog entity
// Note: AuditLog.id is BigInt in the database. It is serialized as number in the API
// response. This is safe because Number.MAX_SAFE_INTEGER (2^53 - 1) supports ~9 quadrillion
// audit entries — acceptable for v1. (T-02-03 accept disposition)

export type AuditAction = 'create' | 'update' | 'void';

export interface AuditEntry {
  id: number;                // BigInt in DB — serialized as number for API (safe for JS up to 2^53)
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
