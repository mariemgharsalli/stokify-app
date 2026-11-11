-- Types de stockage persistés sur Depot (flags déjà affichés en UI).

ALTER TABLE `Depot`
  ADD COLUMN `storageRefrigere` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `storageChimique` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `storageInflammable` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `storageFragile` BOOLEAN NOT NULL DEFAULT false;
