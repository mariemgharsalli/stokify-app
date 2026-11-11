-- Link CommandeClient → Vente (brouillon pour confirmation staff)
ALTER TABLE `CommandeClient` ADD COLUMN `venteId` INTEGER NULL;

CREATE UNIQUE INDEX `CommandeClient_venteId_key` ON `CommandeClient`(`venteId`);

ALTER TABLE `CommandeClient`
  ADD CONSTRAINT `CommandeClient_venteId_fkey`
  FOREIGN KEY (`venteId`) REFERENCES `Vente`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
