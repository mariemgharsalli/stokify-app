-- AlterTable CommandeClient: checkout fields
ALTER TABLE `CommandeClient` ADD COLUMN `adresseLivraison` TEXT NULL;
ALTER TABLE `CommandeClient` ADD COLUMN `notesLivraison` TEXT NULL;
ALTER TABLE `CommandeClient` ADD COLUMN `modePaiement` VARCHAR(191) NULL;

-- CreateTable WishlistItem
CREATE TABLE `WishlistItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clientId` INTEGER NOT NULL,
    `societeId` INTEGER NOT NULL,
    `articleId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WishlistItem_clientId_societeId_idx`(`clientId`, `societeId`),
    UNIQUE INDEX `WishlistItem_clientId_societeId_articleId_key`(`clientId`, `societeId`, `articleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `WishlistItem` ADD CONSTRAINT `WishlistItem_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `WishlistItem` ADD CONSTRAINT `WishlistItem_societeId_fkey` FOREIGN KEY (`societeId`) REFERENCES `Societe`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `WishlistItem` ADD CONSTRAINT `WishlistItem_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
