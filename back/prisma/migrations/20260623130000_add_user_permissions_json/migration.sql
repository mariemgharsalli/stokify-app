-- AlterTable
ALTER TABLE `Utilisateur` ADD COLUMN `permissions` JSON NULL DEFAULT ('{}');
