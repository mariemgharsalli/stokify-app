-- AlterTable NumeroSerie: optional lot link
ALTER TABLE `NumeroSerie` ADD COLUMN `lotId` INTEGER NULL;

CREATE INDEX `NumeroSerie_lotId_fkey` ON `NumeroSerie`(`lotId`);

ALTER TABLE `NumeroSerie` ADD CONSTRAINT `NumeroSerie_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `Lot`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
