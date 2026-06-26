-- [Phase 5] Add receivers catalog and migrate sale.receiver free-text to FK
-- Strategy: add columns nullable → data migrate → enforce NOT NULL → drop old column
-- Column naming: camelCase (matches this project's Prisma convention per init migration)

-- CreateTable: receivers catalog
CREATE TABLE `receivers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizationId` INTEGER NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `accountNumber` VARCHAR(100) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `receivers_organizationId_isActive_idx`(`organizationId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: receivers → organizations
ALTER TABLE `receivers` ADD CONSTRAINT `receivers_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 1: Add new columns as nullable/with defaults (allows data migration before NOT NULL)
ALTER TABLE `sales`
    ADD COLUMN `receiverId` INTEGER NULL,
    ADD COLUMN `receiverNameSnapshot` VARCHAR(255) NOT NULL DEFAULT '';

-- Step 2: Create Receiver records from unique (organizationId, receiver) pairs in sales
-- Each unique receiver string per org becomes one Receiver row
INSERT INTO `receivers` (`organizationId`, `name`, `isActive`, `createdAt`, `updatedAt`)
SELECT DISTINCT `organizationId`, `receiver`, TRUE, NOW(3), NOW(3)
FROM `sales`
WHERE `receiver` IS NOT NULL AND `receiver` != '';

-- Step 3: Backfill receiverId FK on all sale rows by joining on (org, name)
UPDATE `sales` s
JOIN `receivers` r ON s.`organizationId` = r.`organizationId` AND s.`receiver` = r.`name`
SET s.`receiverId` = r.`id`;

-- Step 4: Populate receiverNameSnapshot from old receiver column
UPDATE `sales`
SET `receiverNameSnapshot` = `receiver`
WHERE `receiver` IS NOT NULL AND `receiver` != '';

-- Step 5: Enforce NOT NULL on receiverId (every row now has a value from Step 3)
ALTER TABLE `sales` MODIFY COLUMN `receiverId` INTEGER NOT NULL;

-- Step 6: Add FK constraint from sales.receiverId → receivers.id
ALTER TABLE `sales` ADD CONSTRAINT `sales_receiverId_fkey`
  FOREIGN KEY (`receiverId`) REFERENCES `receivers`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 7: Add composite index on (organizationId, receiverId) for filtered list queries
ALTER TABLE `sales` ADD INDEX `sales_organizationId_receiverId_idx` (`organizationId`, `receiverId`);

-- Step 8: Drop the old free-text receiver column (data is now in receiverId + receiverNameSnapshot)
ALTER TABLE `sales` DROP COLUMN `receiver`;
