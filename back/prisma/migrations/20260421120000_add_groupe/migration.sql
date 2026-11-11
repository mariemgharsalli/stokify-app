-- CreateTable
CREATE TABLE `Groupe` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `societeId` INTEGER NOT NULL,

    UNIQUE INDEX `Groupe_code_societeId_key`(`code`, `societeId`),
    INDEX `Groupe_societeId_fkey`(`societeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Groupe` ADD CONSTRAINT `Groupe_societeId_fkey` FOREIGN KEY (`societeId`) REFERENCES `Societe`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `Article` ADD COLUMN `groupeId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Article_groupeId_fkey` ON `Article`(`groupeId`);

-- AddForeignKey
ALTER TABLE `Article` ADD CONSTRAINT `Article_groupeId_fkey` FOREIGN KEY (`groupeId`) REFERENCES `Groupe`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
