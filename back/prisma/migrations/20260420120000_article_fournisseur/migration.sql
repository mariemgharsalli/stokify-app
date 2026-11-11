-- AlterTable
ALTER TABLE `Article` ADD COLUMN `fournisseurId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Article_fournisseurId_idx` ON `Article`(`fournisseurId`);

-- AddForeignKey
ALTER TABLE `Article` ADD CONSTRAINT `Article_fournisseurId_fkey` FOREIGN KEY (`fournisseurId`) REFERENCES `Fournisseur`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
