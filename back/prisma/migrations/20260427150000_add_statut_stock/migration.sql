-- Normaliser les anciennes valeurs (français / casse) vers ACTIF | ARCHIVE | BLOQUE
UPDATE `Stock` SET `statut` = 'ARCHIVE' WHERE LOWER(TRIM(`statut`)) IN ('archivé', 'archive', 'archiv');
UPDATE `Stock` SET `statut` = 'BLOQUE' WHERE LOWER(TRIM(`statut`)) IN ('bloqué', 'bloque');
UPDATE `Stock` SET `statut` = 'ACTIF' WHERE `statut` IS NULL OR LOWER(TRIM(`statut`)) IN ('actif', 'active') OR `statut` NOT IN ('ACTIF', 'ARCHIVE', 'BLOQUE');

ALTER TABLE `Stock` MODIFY `statut` VARCHAR(191) NOT NULL DEFAULT 'ACTIF';
