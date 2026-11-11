-- Ajoute ville et coordonnées géographiques à Societe (adresse existait déjà).
-- Si les colonnes existent déjà, exécuter manuellement les ALTER nécessaires ou ignorer cette migration.

ALTER TABLE `Societe` ADD COLUMN `ville` VARCHAR(191) NULL,
    ADD COLUMN `latitude` DOUBLE NULL,
    ADD COLUMN `longitude` DOUBLE NULL;
