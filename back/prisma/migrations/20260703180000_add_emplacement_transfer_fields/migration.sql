-- AlterTable
ALTER TABLE `Mouvement` ADD COLUMN `emplacementId` INTEGER NULL,
    ADD COLUMN `emplacementDestId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Mouvement` ADD CONSTRAINT `Mouvement_emplacementId_fkey` FOREIGN KEY (`emplacementId`) REFERENCES `Emplacement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Mouvement` ADD CONSTRAINT `Mouvement_emplacementDestId_fkey` FOREIGN KEY (`emplacementDestId`) REFERENCES `Emplacement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
