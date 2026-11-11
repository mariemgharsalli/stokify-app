-- CreateTable CouchesFifo
CREATE TABLE `CouchesFifo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `articleId` INTEGER NOT NULL,
    `depotId` INTEGER NOT NULL,
    `lotId` INTEGER NULL,
    `quantiteInitiale` DOUBLE NOT NULL,
    `quantiteRestante` DOUBLE NOT NULL,
    `prixUnitaire` DOUBLE NOT NULL,
    `dateEntree` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `orderIndex` INTEGER NOT NULL,
    `achatId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable HistoriqueCMP
CREATE TABLE `HistoriqueCMP` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `articleId` INTEGER NOT NULL,
    `depotId` INTEGER NOT NULL,
    `ancienCMP` DOUBLE NOT NULL,
    `nouveauCMP` DOUBLE NOT NULL,
    `quantiteEntree` DOUBLE NOT NULL,
    `prixEntree` DOUBLE NOT NULL,
    `dateCalcul` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CouchesFifo` ADD CONSTRAINT `CouchesFifo_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CouchesFifo` ADD CONSTRAINT `CouchesFifo_depotId_fkey` FOREIGN KEY (`depotId`) REFERENCES `Depot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CouchesFifo` ADD CONSTRAINT `CouchesFifo_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `Lot`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `HistoriqueCMP` ADD CONSTRAINT `HistoriqueCMP_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `HistoriqueCMP` ADD CONSTRAINT `HistoriqueCMP_depotId_fkey` FOREIGN KEY (`depotId`) REFERENCES `Depot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX `CouchesFifo_articleId_depotId_idx` ON `CouchesFifo`(`articleId`, `depotId`);
CREATE INDEX `HistoriqueCMP_articleId_depotId_idx` ON `HistoriqueCMP`(`articleId`, `depotId`);
