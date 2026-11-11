-- Traceability fields on sale lines (safe if columns already exist)
SET @db := DATABASE();

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'LigneVente' AND COLUMN_NAME = 'lotsConsumed') = 0,
  'ALTER TABLE `LigneVente` ADD COLUMN `lotsConsumed` TEXT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'LigneVente' AND COLUMN_NAME = 'strategieAppliquee') = 0,
  'ALTER TABLE `LigneVente` ADD COLUMN `strategieAppliquee` VARCHAR(191) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'LigneVente' AND COLUMN_NAME = 'strategie') = 0,
  'ALTER TABLE `LigneVente` ADD COLUMN `strategie` VARCHAR(191) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
