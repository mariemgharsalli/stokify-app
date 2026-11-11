-- AlterTable
ALTER TABLE `AnomalieDetectee` ADD COLUMN `feedback` VARCHAR(191) NULL;
ALTER TABLE `AnomalieDetectee` ADD COLUMN `modele` VARCHAR(191) NULL;
ALTER TABLE `AnomalieDetectee` ADD COLUMN `mlMeta` JSON NULL;
