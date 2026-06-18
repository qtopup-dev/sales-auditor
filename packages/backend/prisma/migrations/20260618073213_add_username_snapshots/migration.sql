-- AlterTable: Add username snapshot columns to sales and audit_log
-- These are denormalized fields written at mutation time — never joined back to users table

ALTER TABLE `sales` ADD COLUMN `createdByUsername` VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE `sales` ADD COLUMN `lastEditedByUsername` VARCHAR(100) NULL;
ALTER TABLE `audit_log` ADD COLUMN `userUsername` VARCHAR(100) NOT NULL DEFAULT '';
