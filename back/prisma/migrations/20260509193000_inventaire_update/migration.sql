-- AlterTable
ALTER TABLE `LigneInventaire` ADD COLUMN `lotId` INT NULL,
    ADD COLUMN `emplacementId` INT NULL,
    ADD COLUMN `valeurEcart` DECIMAL(18, 4) NULL;

-- CreateIndex (optional; Prisma may not require unique on FK)
-- AddForeignKey
ALTER TABLE `LigneInventaire` ADD CONSTRAINT `LigneInventaire_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `Lot` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LigneInventaire` ADD CONSTRAINT `LigneInventaire_emplacementId_fkey` FOREIGN KEY (`emplacementId`) REFERENCES `Emplacement` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
