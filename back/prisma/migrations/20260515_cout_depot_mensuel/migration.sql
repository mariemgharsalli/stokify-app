-- CreateTable CoutDepotMensuel
CREATE TABLE `CoutDepotMensuel` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `depotId` INTEGER NOT NULL,
    `societeId` INTEGER NOT NULL,
    `periode` VARCHAR(191) NOT NULL,
    `coutLoyer` DOUBLE NOT NULL DEFAULT 0,
    `coutPersonnel` DOUBLE NOT NULL DEFAULT 0,
    `coutEnergie` DOUBLE NOT NULL DEFAULT 0,
    `coutManutention` DOUBLE NOT NULL DEFAULT 0,
    `autresFrais` DOUBLE NOT NULL DEFAULT 0,
    `total` DOUBLE NOT NULL DEFAULT 0,
    `commentaire` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CoutDepotMensuel_depotId_periode_key`(`depotId`, `periode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CoutDepotMensuel` ADD CONSTRAINT `CoutDepotMensuel_depotId_fkey` FOREIGN KEY (`depotId`) REFERENCES `Depot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CoutDepotMensuel` ADD CONSTRAINT `CoutDepotMensuel_societeId_fkey` FOREIGN KEY (`societeId`) REFERENCES `Societe`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
