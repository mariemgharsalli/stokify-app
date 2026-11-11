-- AlterTable Societe.actif (idempotent: évite l'erreur 1060 si la colonne existe déjà)
SET @add_actif = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'Societe'
        AND COLUMN_NAME = 'actif'
    ) = 0,
    'ALTER TABLE `Societe` ADD COLUMN `actif` BOOLEAN NOT NULL DEFAULT true',
    'SELECT 1'
  )
);
PREPARE stmt FROM @add_actif;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
