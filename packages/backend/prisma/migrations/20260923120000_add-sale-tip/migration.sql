-- [Phase 13] Add optional tip column to sales.
-- Additive-only: one nullable column on `sales`; existing rows get NULL (no tip
-- recorded). No other table is touched.
ALTER TABLE `sales` ADD COLUMN `tip` DECIMAL(10, 2) NULL;
