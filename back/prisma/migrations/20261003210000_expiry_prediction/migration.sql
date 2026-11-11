-- CreateTable
CREATE TABLE `ExpiryPrediction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societeId` INTEGER NOT NULL,
    `lotId` INTEGER NOT NULL,
    `asOf` DATETIME(3) NOT NULL,
    `joursRestants` INTEGER NOT NULL,
    `qteRestante` DOUBLE NOT NULL,
    `pWaste` DOUBLE NOT NULL,
    `qteP50` DOUBLE NOT NULL,
    `qteP90` DOUBLE NOT NULL,
    `modelVersion` VARCHAR(191) NOT NULL,
    `features` JSON NOT NULL,
    `observedWasteQty` DOUBLE NULL,
    `observedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ExpiryPrediction_lotId_asOf_key`(`lotId`, `asOf`),
    INDEX `ExpiryPrediction_societeId_observedAt_idx`(`societeId`, `observedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
