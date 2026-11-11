-- Champs détaillés par mode de paiement (Reglement + ReglementAchat)
ALTER TABLE `Reglement` ADD COLUMN `commentaire` VARCHAR(191) NULL;
ALTER TABLE `Reglement` ADD COLUMN `numeroCheque` VARCHAR(191) NULL;
ALTER TABLE `Reglement` ADD COLUMN `banque` VARCHAR(191) NULL;
ALTER TABLE `Reglement` ADD COLUMN `dateEcheance` DATETIME(3) NULL;
ALTER TABLE `Reglement` ADD COLUMN `referenceVirement` VARCHAR(191) NULL;
ALTER TABLE `Reglement` ADD COLUMN `dateValeur` DATETIME(3) NULL;
ALTER TABLE `Reglement` ADD COLUMN `referenceTransaction` VARCHAR(191) NULL;
ALTER TABLE `Reglement` ADD COLUMN `referenceEffet` VARCHAR(191) NULL;
ALTER TABLE `Reglement` ADD COLUMN `descriptionAutre` VARCHAR(191) NULL;

ALTER TABLE `ReglementAchat` ADD COLUMN `commentaire` VARCHAR(191) NULL;
ALTER TABLE `ReglementAchat` ADD COLUMN `numeroCheque` VARCHAR(191) NULL;
ALTER TABLE `ReglementAchat` ADD COLUMN `banque` VARCHAR(191) NULL;
ALTER TABLE `ReglementAchat` ADD COLUMN `dateEcheance` DATETIME(3) NULL;
ALTER TABLE `ReglementAchat` ADD COLUMN `referenceVirement` VARCHAR(191) NULL;
ALTER TABLE `ReglementAchat` ADD COLUMN `dateValeur` DATETIME(3) NULL;
ALTER TABLE `ReglementAchat` ADD COLUMN `referenceTransaction` VARCHAR(191) NULL;
ALTER TABLE `ReglementAchat` ADD COLUMN `referenceEffet` VARCHAR(191) NULL;
ALTER TABLE `ReglementAchat` ADD COLUMN `descriptionAutre` VARCHAR(191) NULL;
