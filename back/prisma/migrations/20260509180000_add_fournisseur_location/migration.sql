-- AlterTable
ALTER TABLE `Fournisseur` ADD COLUMN `ville` VARCHAR(191) NULL,
    ADD COLUMN `pays` VARCHAR(191) NULL,
    ADD COLUMN `latitude` DOUBLE NULL,
    ADD COLUMN `longitude` DOUBLE NULL;
