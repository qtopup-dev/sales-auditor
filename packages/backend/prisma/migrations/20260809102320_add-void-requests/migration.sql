-- [Phase 12] Add void_requests table for the moderator Void Request workflow.
-- Additive-only: this migration creates one brand-new table and touches no existing
-- table (sales, audit_log, shifts, products, mops, users, receivers, organizations
-- are all left completely unaltered).
-- `pendingLock` is a DB-level race guard for CONTEXT.md D-02 ("at most one pending
-- Void Request per sale row"), mirroring the Phase 7 `shifts.openLock` precedent, and
-- is intentionally absent from schema.prisma (Prisma never reads or writes it).

-- CreateTable: void_requests (foreign keys added AFTER the generated column below —
-- MySQL 8.4 raises a spurious ER_CANNOT_ADD_FOREIGN error when adding a STORED
-- generated column to a table that already has FK constraints defined, due to the
-- table-rebuild algorithm MySQL uses for STORED generated columns. Adding the
-- generated column first, then the FKs, avoids this MySQL limitation.)
CREATE TABLE `void_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL,
    `saleId` INTEGER NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `requestedById` INTEGER NOT NULL,
    `requestedByUsername` VARCHAR(100) NOT NULL,
    `reviewedById` INTEGER NULL,
    `reviewedByUsername` VARCHAR(100) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `void_requests_organizationId_status_idx`(`organizationId`, `status`),
    INDEX `void_requests_organizationId_saleId_idx`(`organizationId`, `saleId`),
    INDEX `void_requests_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- SECURITY (T-12-01, security_context): DB-level guard against two concurrent Void
-- Requests being submitted for the same sale row. This generated column collapses to
-- NULL whenever a request is no longer pending (status IS NOT 'pending'); MySQL unique
-- indexes permit unlimited NULLs, so only the currently PENDING request per
-- (organizationId, saleId) is constrained. A concurrent second insert for the same sale
-- row will fail this unique index with a Prisma P2002 error, which the create-request
-- route handler (Plan 12-02) catches and maps to 409 DUPLICATE_PENDING_REQUEST. Because
-- a rejected request's `pendingLock` also collapses to NULL, the same sale row can
-- receive a new pending request afterwards (D-03 — no permanent lockout).
-- This column is intentionally NOT declared in schema.prisma — same precedent as the
-- `Shift.openLock` generated column and the unmanaged `sessions` table (see comment at
-- the bottom of schema.prisma).
-- NOTE: added before the FK constraints below (see CreateTable comment above for why).
ALTER TABLE `void_requests`
  ADD COLUMN `pendingLock` INT GENERATED ALWAYS AS (IF(`status` = 'pending', `saleId`, NULL)) STORED;

ALTER TABLE `void_requests`
  ADD UNIQUE INDEX `void_requests_organizationId_pendingLock_key` (`organizationId`, `pendingLock`);

-- AddForeignKey: void_requests → organizations
ALTER TABLE `void_requests` ADD CONSTRAINT `void_requests_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: void_requests → sales
-- NOTE: ON UPDATE RESTRICT (not this project's usual ON UPDATE CASCADE convention).
-- MySQL 8.4 forbids ON UPDATE CASCADE/SET NULL/SET DEFAULT on a base column (saleId)
-- that is referenced inside an INDEXED generated column's expression (pendingLock above
-- reads `saleId`) — MySQL raises a misleading "Cannot add foreign key constraint" error
-- if CASCADE is used here. RESTRICT is functionally equivalent in this app since
-- `sales.id` is an immutable auto-increment primary key that is never UPDATEd.
ALTER TABLE `void_requests` ADD CONSTRAINT `void_requests_saleId_fkey`
  FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey: void_requests → users (requester)
ALTER TABLE `void_requests` ADD CONSTRAINT `void_requests_requestedById_fkey`
  FOREIGN KEY (`requestedById`) REFERENCES `users`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: void_requests → users (reviewer)
ALTER TABLE `void_requests` ADD CONSTRAINT `void_requests_reviewedById_fkey`
  FOREIGN KEY (`reviewedById`) REFERENCES `users`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
