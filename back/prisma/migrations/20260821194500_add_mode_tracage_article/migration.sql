-- AlterTable
ALTER TABLE `Article` ADD COLUMN `modeTracage` VARCHAR(191) NOT NULL DEFAULT 'AUCUN';
ALTER TABLE `Article` ADD COLUMN `tracageAuto` BOOLEAN NOT NULL DEFAULT false;

-- Backfill from legacy modeGestion (do not drop the column)
UPDATE `Article`
SET `modeTracage` = 'LOT', `tracageAuto` = false
WHERE UPPER(`modeGestion`) IN ('LOTS', 'FIFO', 'LOT', 'FEFO');
