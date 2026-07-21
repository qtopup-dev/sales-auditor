-- [Phase 10] Add deletedAt soft-delete signal to Receiver (mirrors Phase 9 D-01 for Product/Mop/User)
-- Second soft-delete field distinct from isActive: Delete is a stricter, irreversible-from-the-UI
-- action; Deactivate remains instant/reversible and its isActive semantics are untouched.
-- Deleted rows are never physically removed from the database (CLAUDE.md Rule 3).
-- Does NOT touch sales, audit_log, shifts, products, mops, or users tables -- historical sales rows
-- keep their receiverNameSnapshot regardless of a later receiver delete (CLAUDE.md Rule 4).

ALTER TABLE `receivers` ADD COLUMN `deletedAt` DATETIME(3) NULL;
ALTER TABLE `receivers` ADD INDEX `receivers_organizationId_deletedAt_idx` (`organizationId`, `deletedAt`);
