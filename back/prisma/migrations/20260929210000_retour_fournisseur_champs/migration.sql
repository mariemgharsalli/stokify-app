-- Le modèle Prisma RetourFournisseur a des colonnes jamais créées en base.
-- L'insertion au moment de « Confirmer le retour » renvoyait Prisma P2022.

ALTER TABLE `RetourFournisseur` DROP FOREIGN KEY `RetourFournisseur_mouvementId_fkey`;

ALTER TABLE `RetourFournisseur`
    ADD COLUMN `reference` VARCHAR(191) NOT NULL,
    ADD COLUMN `achatId` INTEGER NULL,
    ADD COLUMN `lotId` INTEGER NULL,
    ADD COLUMN `articleId` INTEGER NULL,
    ADD COLUMN `quantiteRetournee` DOUBLE NULL,
    ADD COLUMN `quantiteAchetee` DOUBLE NULL,
    ADD COLUMN `statut` ENUM('EN_ATTENTE', 'ACCEPTE', 'REFUSE', 'REMPLACEMENT_DEMANDE', 'AVOIR_EMIS') NOT NULL DEFAULT 'EN_ATTENTE',
    ADD COLUMN `avoirGenere` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `montantAvoir` DOUBLE NULL,
    ADD COLUMN `notes` TEXT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    MODIFY `mouvementId` INTEGER NULL,
    MODIFY `motif` ENUM('NON_CONFORME', 'ABIME', 'ERREUR_REFERENCE', 'DATE_PEREMPTION_COURTE', 'SURPLUS', 'QUALITE_INSUFFISANTE', 'AUTRE') NOT NULL DEFAULT 'AUTRE';

CREATE UNIQUE INDEX `RetourFournisseur_reference_key` ON `RetourFournisseur`(`reference`);

ALTER TABLE `RetourFournisseur` ADD CONSTRAINT `RetourFournisseur_achatId_fkey` FOREIGN KEY (`achatId`) REFERENCES `Achat`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RetourFournisseur` ADD CONSTRAINT `RetourFournisseur_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `Lot`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RetourFournisseur` ADD CONSTRAINT `RetourFournisseur_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RetourFournisseur` ADD CONSTRAINT `RetourFournisseur_mouvementId_fkey` FOREIGN KEY (`mouvementId`) REFERENCES `Mouvement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
