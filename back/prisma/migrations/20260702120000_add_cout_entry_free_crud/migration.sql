-- CreateTable
CREATE TABLE `CoutEntry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nom` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `montant` DOUBLE NOT NULL,
    `periode` VARCHAR(191) NOT NULL,
    `depotId` INTEGER NOT NULL,
    `societeId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` INTEGER NULL,

    INDEX `CoutEntry_depotId_periode_societeId_idx`(`depotId`, `periode`, `societeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CoutEntry` ADD CONSTRAINT `CoutEntry_depotId_fkey` FOREIGN KEY (`depotId`) REFERENCES `Depot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CoutEntry` ADD CONSTRAINT `CoutEntry_societeId_fkey` FOREIGN KEY (`societeId`) REFERENCES `Societe`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CoutEntry` ADD CONSTRAINT `CoutEntry_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `Utilisateur`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
