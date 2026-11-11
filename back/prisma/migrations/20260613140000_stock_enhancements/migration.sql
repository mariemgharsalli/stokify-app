-- AlterTable Article
ALTER TABLE `Article` ADD COLUMN `seuilAlerte` DOUBLE NULL;

-- AlterTable Societe
ALTER TABLE `Societe` ADD COLUMN `seuilValidationMouvement` DOUBLE NOT NULL DEFAULT 1000;

-- AlterTable Mouvement
ALTER TABLE `Mouvement` ADD COLUMN `statut` VARCHAR(191) NOT NULL DEFAULT 'VALIDE';

-- CreateTable AlerteStock
CREATE TABLE `AlerteStock` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `articleId` INTEGER NOT NULL,
    `depotId` INTEGER NOT NULL,
    `societeId` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AlerteStock_articleId_depotId_type_createdAt_idx`(`articleId`, `depotId`, `type`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable AuditLog
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `oldValue` TEXT NULL,
    `newValue` TEXT NULL,
    `userId` INTEGER NOT NULL,
    `societeId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_societeId_entityType_createdAt_idx`(`societeId`, `entityType`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable RetourFournisseur
CREATE TABLE `RetourFournisseur` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mouvementId` INTEGER NOT NULL,
    `fournisseurId` INTEGER NOT NULL,
    `motif` VARCHAR(191) NOT NULL,
    `societeId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RetourFournisseur_mouvementId_key`(`mouvementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AlerteStock` ADD CONSTRAINT `AlerteStock_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AlerteStock` ADD CONSTRAINT `AlerteStock_depotId_fkey` FOREIGN KEY (`depotId`) REFERENCES `Depot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AlerteStock` ADD CONSTRAINT `AlerteStock_societeId_fkey` FOREIGN KEY (`societeId`) REFERENCES `Societe`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Utilisateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_societeId_fkey` FOREIGN KEY (`societeId`) REFERENCES `Societe`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `RetourFournisseur` ADD CONSTRAINT `RetourFournisseur_mouvementId_fkey` FOREIGN KEY (`mouvementId`) REFERENCES `Mouvement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `RetourFournisseur` ADD CONSTRAINT `RetourFournisseur_fournisseurId_fkey` FOREIGN KEY (`fournisseurId`) REFERENCES `Fournisseur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `RetourFournisseur` ADD CONSTRAINT `RetourFournisseur_societeId_fkey` FOREIGN KEY (`societeId`) REFERENCES `Societe`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
