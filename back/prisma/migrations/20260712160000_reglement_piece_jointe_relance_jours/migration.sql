-- AlterTable
ALTER TABLE `Societe` ADD COLUMN `joursRelanceClient` INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE `Reglement` ADD COLUMN `pieceJointeUrl` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ReglementAchat` ADD COLUMN `pieceJointeUrl` VARCHAR(191) NULL;
