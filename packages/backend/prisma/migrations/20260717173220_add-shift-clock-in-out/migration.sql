-- [Phase 7] Add shifts table for moderator clock in/out tracking
-- Sale.shiftId is nullable — pre-Phase-7 sales rows have no shift context (D-02).
-- No backfill needed: existing sales rows simply have shiftId = NULL.

-- CreateTable: shifts (foreign keys added AFTER the generated column below —
-- MySQL 8.4 raises a spurious ER_CANNOT_ADD_FOREIGN error when adding a STORED
-- generated column to a table that already has FK constraints defined, due to
-- the table-rebuild algorithm MySQL uses for STORED generated columns. Adding
-- the generated column first, then the FKs, avoids this MySQL limitation.)
CREATE TABLE `shifts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `clockInAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `clockOutAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `shifts_organizationId_userId_idx`(`organizationId`, `userId`),
    INDEX `shifts_organizationId_clockInAt_idx`(`organizationId`, `clockInAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- SECURITY (T-07-01, security_context): DB-level guard against a race condition on rapid
-- double clock-in clicks. This generated column collapses to NULL whenever a shift is
-- closed (clockOutAt IS NOT NULL); MySQL unique indexes permit unlimited NULLs, so only
-- the currently OPEN shift per (organizationId, userId) is constrained. A concurrent
-- second clock-in attempt for the same moderator will fail this unique index with a
-- Prisma P2002 error, which the clock-in route handler catches and treats as the D-01
-- no-op (returns the shift that won the race) instead of a 500.
-- This column is intentionally NOT declared in schema.prisma — same precedent as the
-- unmanaged `sessions` table (see comment at the bottom of schema.prisma).
-- NOTE: added before the FK constraints below (see CreateTable comment above for why).
ALTER TABLE `shifts`
  ADD COLUMN `openLock` INT GENERATED ALWAYS AS (IF(`clockOutAt` IS NULL, `userId`, NULL)) STORED;

ALTER TABLE `shifts`
  ADD UNIQUE INDEX `shifts_organizationId_openLock_key` (`organizationId`, `openLock`);

-- AddForeignKey: shifts → organizations
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: shifts → users
-- NOTE: ON UPDATE RESTRICT (not this project's usual ON UPDATE CASCADE convention).
-- MySQL 8.4 forbids ON UPDATE CASCADE/SET NULL/SET DEFAULT on a base column (userId)
-- that is referenced inside an INDEXED generated column's expression (openLock above
-- reads `userId`) — MySQL raises a misleading "Cannot add foreign key constraint"
-- error if CASCADE is used here. RESTRICT is functionally equivalent in this app since
-- `users.id` is an immutable auto-increment primary key that is never UPDATEd.
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Add nullable shiftId FK column to sales (D-02: nullable — pre-Phase-7 rows predate shift tracking)
ALTER TABLE `sales` ADD COLUMN `shiftId` INTEGER NULL;

-- AddForeignKey: sales.shiftId → shifts.id
ALTER TABLE `sales` ADD CONSTRAINT `sales_shiftId_fkey`
  FOREIGN KEY (`shiftId`) REFERENCES `shifts`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add composite index for shift-scoped sales queries (D-11)
ALTER TABLE `sales` ADD INDEX `sales_organizationId_shiftId_idx` (`organizationId`, `shiftId`);
