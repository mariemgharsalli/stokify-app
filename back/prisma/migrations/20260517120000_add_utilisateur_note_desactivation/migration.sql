-- Idempotent : evite l'erreur 1060 si les colonnes ont deja ete ajoutees a la main.
SELECT COUNT(*) INTO @cnd FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Utilisateur' AND COLUMN_NAME = 'noteDesactivation';
SET @q1 = IF(@cnd = 0, 'ALTER TABLE `Utilisateur` ADD COLUMN `noteDesactivation` VARCHAR(191) NULL', 'SELECT 1');
PREPARE stmt1 FROM @q1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

SELECT COUNT(*) INTO @cdd FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Utilisateur' AND COLUMN_NAME = 'dateDesactivation';
SET @q2 = IF(@cdd = 0, 'ALTER TABLE `Utilisateur` ADD COLUMN `dateDesactivation` DATETIME(3) NULL', 'SELECT 1');
PREPARE stmt2 FROM @q2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;
