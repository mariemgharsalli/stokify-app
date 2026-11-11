-- CreateTable Marque
CREATE TABLE `Marque` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `societeId` INTEGER NOT NULL,

    UNIQUE INDEX `Marque_code_societeId_key`(`code`, `societeId`),
    INDEX `Marque_societeId_fkey`(`societeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Marque` ADD CONSTRAINT `Marque_societeId_fkey` FOREIGN KEY (`societeId`) REFERENCES `Societe`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable Article
ALTER TABLE `Article` ADD COLUMN `marqueId` INTEGER NULL;
CREATE INDEX `Article_marqueId_fkey` ON `Article`(`marqueId`);
ALTER TABLE `Article` ADD CONSTRAINT `Article_marqueId_fkey` FOREIGN KEY (`marqueId`) REFERENCES `Marque`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable NumeroSerie
CREATE TABLE `NumeroSerie` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `numero` VARCHAR(191) NOT NULL,
    `articleId` INTEGER NOT NULL,
    `societeId` INTEGER NOT NULL,
    `statut` VARCHAR(191) NOT NULL DEFAULT 'DISPONIBLE',
    `depotId` INTEGER NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `NumeroSerie_numero_key`(`numero`),
    INDEX `NumeroSerie_articleId_fkey`(`articleId`),
    INDEX `NumeroSerie_societeId_fkey`(`societeId`),
    INDEX `NumeroSerie_depotId_fkey`(`depotId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `NumeroSerie` ADD CONSTRAINT `NumeroSerie_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `NumeroSerie` ADD CONSTRAINT `NumeroSerie_societeId_fkey` FOREIGN KEY (`societeId`) REFERENCES `Societe`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `NumeroSerie` ADD CONSTRAINT `NumeroSerie_depotId_fkey` FOREIGN KEY (`depotId`) REFERENCES `Depot`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable CoutStockage
CREATE TABLE `CoutStockage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societeId` INTEGER NOT NULL,
    `articleId` INTEGER NOT NULL,
    `depotId` INTEGER NOT NULL,
    `coutUnitaire` DOUBLE NOT NULL,
    `devise` VARCHAR(191) NULL DEFAULT 'TND',
    `periodeDebut` DATETIME(3) NOT NULL,
    `periodeFin` DATETIME(3) NULL,
    `commentaire` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CoutStockage_societeId_fkey`(`societeId`),
    INDEX `CoutStockage_articleId_fkey`(`articleId`),
    INDEX `CoutStockage_depotId_fkey`(`depotId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CoutStockage` ADD CONSTRAINT `CoutStockage_societeId_fkey` FOREIGN KEY (`societeId`) REFERENCES `Societe`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CoutStockage` ADD CONSTRAINT `CoutStockage_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CoutStockage` ADD CONSTRAINT `CoutStockage_depotId_fkey` FOREIGN KEY (`depotId`) REFERENCES `Depot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable ReglementAchat
CREATE TABLE `ReglementAchat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `achatId` INTEGER NOT NULL,
    `montant` DOUBLE NOT NULL,
    `datePayment` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reference` VARCHAR(191) NULL,
    `mode` VARCHAR(191) NOT NULL,
    `statut` VARCHAR(191) NOT NULL DEFAULT 'EN_ATTENTE',

    INDEX `ReglementAchat_achatId_fkey`(`achatId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ReglementAchat` ADD CONSTRAINT `ReglementAchat_achatId_fkey` FOREIGN KEY (`achatId`) REFERENCES `Achat`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
