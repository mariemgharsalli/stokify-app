-- AlterTable
ALTER TABLE `Utilisateur` ADD COLUMN `clientId` INTEGER NULL,
    ADD COLUMN `statutCompte` VARCHAR(191) NOT NULL DEFAULT 'ACTIF';

-- AddForeignKey
ALTER TABLE `Utilisateur` ADD CONSTRAINT `Utilisateur_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
