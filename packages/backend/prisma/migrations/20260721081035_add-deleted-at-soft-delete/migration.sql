-- [Phase 9] Add deletedAt soft-delete signal to Product, Mop, User (CONTEXT.md D-01)
-- Second soft-delete field distinct from isActive: Delete is a stricter, irreversible-from-the-UI
-- action; Deactivate remains instant/reversible and its isActive semantics are untouched.
-- Deleted rows are never physically removed from the database (CLAUDE.md Rule 3).
-- Does NOT touch sales, audit_log, or shifts tables (D-03) -- historical rows keep their
-- product/mop/user name snapshots regardless of a later delete.

ALTER TABLE `products` ADD COLUMN `deletedAt` DATETIME(3) NULL;
ALTER TABLE `products` ADD INDEX `products_organizationId_deletedAt_idx` (`organizationId`, `deletedAt`);

ALTER TABLE `mops` ADD COLUMN `deletedAt` DATETIME(3) NULL;
ALTER TABLE `mops` ADD INDEX `mops_organizationId_deletedAt_idx` (`organizationId`, `deletedAt`);

ALTER TABLE `users` ADD COLUMN `deletedAt` DATETIME(3) NULL;
ALTER TABLE `users` ADD INDEX `users_organizationId_deletedAt_idx` (`organizationId`, `deletedAt`);
