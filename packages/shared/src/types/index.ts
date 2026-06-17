// Re-exports all domain types for use in backend and frontend
// Import pattern: import { User, Sale, Product } from '@alejinput/shared'
//
// Note: .js extensions are required in ESM import paths even for .ts source files.
// Node.js with "moduleResolution": "node16" requires the .js extension in source;
// the TypeScript compiler resolves .js imports to .ts files at compile time.

export type { Role, User, Organization } from './user.js';
export type { Product } from './product.js';
export type { Mop } from './mop.js';
export type { SaleStatus, Sale } from './sale.js';
export type { AuditAction, AuditEntry } from './audit.js';
export type { InviteToken, AuthSession } from './auth.js';
