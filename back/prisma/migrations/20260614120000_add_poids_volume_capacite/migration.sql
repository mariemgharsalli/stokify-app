-- AlterTable Article: poids, volume
ALTER TABLE `Article` ADD COLUMN `poids` DOUBLE NULL,
    ADD COLUMN `volume` DOUBLE NULL;

-- AlterTable Depot: capaciteVolume, capacitePoids
ALTER TABLE `Depot` ADD COLUMN `capaciteVolume` DOUBLE NULL,
    ADD COLUMN `capacitePoids` DOUBLE NULL;

-- AlterTable Emplacement: zoneDangereuse, categorieAutorisee
ALTER TABLE `Emplacement` ADD COLUMN `zoneDangereuse` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `categorieAutorisee` VARCHAR(191) NULL;

-- CreateTable Vehicule
CREATE TABLE `Vehicule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societeId` INTEGER NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `immatriculation` VARCHAR(191) NULL,
    `capacitePoids` DOUBLE NOT NULL,
    `capaciteVolume` DOUBLE NOT NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Vehicule` ADD CONSTRAINT `Vehicule_societeId_fkey` FOREIGN KEY (`societeId`) REFERENCES `Societe`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
