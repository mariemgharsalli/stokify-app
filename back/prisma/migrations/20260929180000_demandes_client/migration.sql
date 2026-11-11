-- CreateTable
CREATE TABLE `DemandeClient` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societeId` INTEGER NOT NULL,
    `clientId` INTEGER NOT NULL,
    `articleId` INTEGER NULL,
    `commandeId` INTEGER NULL,
    `sujet` VARCHAR(191) NOT NULL,
    `statut` VARCHAR(191) NOT NULL DEFAULT 'OUVERTE',
    `nonLuEquipe` BOOLEAN NOT NULL DEFAULT true,
    `nonLuClient` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DemandeClient_societeId_nonLuEquipe_idx`(`societeId`, `nonLuEquipe`),
    INDEX `DemandeClient_clientId_societeId_idx`(`clientId`, `societeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MessageDemande` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `demandeId` INTEGER NOT NULL,
    `auteurId` INTEGER NOT NULL,
    `corps` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MessageDemande_demandeId_createdAt_idx`(`demandeId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DemandeClient` ADD CONSTRAINT `DemandeClient_societeId_fkey` FOREIGN KEY (`societeId`) REFERENCES `Societe`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DemandeClient` ADD CONSTRAINT `DemandeClient_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DemandeClient` ADD CONSTRAINT `DemandeClient_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DemandeClient` ADD CONSTRAINT `DemandeClient_commandeId_fkey` FOREIGN KEY (`commandeId`) REFERENCES `CommandeClient`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MessageDemande` ADD CONSTRAINT `MessageDemande_demandeId_fkey` FOREIGN KEY (`demandeId`) REFERENCES `DemandeClient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MessageDemande` ADD CONSTRAINT `MessageDemande_auteurId_fkey` FOREIGN KEY (`auteurId`) REFERENCES `Utilisateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
