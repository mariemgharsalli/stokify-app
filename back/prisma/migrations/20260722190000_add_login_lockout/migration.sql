-- AlterTable
ALTER TABLE `Utilisateur` ADD COLUMN `tentativesEchouees` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `Utilisateur` ADD COLUMN `verrouilleJusqua` DATETIME(3) NULL;
