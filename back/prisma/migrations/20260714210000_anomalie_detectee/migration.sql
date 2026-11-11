-- CreateTable
CREATE TABLE `AnomalieDetectee` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `articleId` INTEGER NOT NULL,
    `depotId` INTEGER NOT NULL,
    `mouvementId` INTEGER NOT NULL,
    `score` DOUBLE NOT NULL,
    `raison` VARCHAR(191) NOT NULL,
    `quantiteObservee` DOUBLE NULL,
    `moyenneHabituelle` DOUBLE NULL,
    `dateDetection` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dateResolution` DATETIME(3) NULL,
    `statut` VARCHAR(191) NOT NULL DEFAULT 'NON_RESOLU',

    INDEX `AnomalieDetectee_statut_dateDetection_idx`(`statut`, `dateDetection`),
    INDEX `AnomalieDetectee_articleId_depotId_idx`(`articleId`, `depotId`),
    INDEX `AnomalieDetectee_mouvementId_statut_idx`(`mouvementId`, `statut`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AnomalieDetectee` ADD CONSTRAINT `AnomalieDetectee_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AnomalieDetectee` ADD CONSTRAINT `AnomalieDetectee_depotId_fkey` FOREIGN KEY (`depotId`) REFERENCES `Depot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AnomalieDetectee` ADD CONSTRAINT `AnomalieDetectee_mouvementId_fkey` FOREIGN KEY (`mouvementId`) REFERENCES `Mouvement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
