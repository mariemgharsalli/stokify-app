-- AlterTable
ALTER TABLE `Fournisseur` ADD COLUMN `actif` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `Client` ADD COLUMN `actif` BOOLEAN NOT NULL DEFAULT true;
