-- CreateTable
CREATE TABLE `Societe` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `adresse` VARCHAR(191) NULL,
    `telephones` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `capital` DOUBLE NULL,
    `logo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Societe_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Depot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `libelle` VARCHAR(191) NOT NULL,
    `adresse` VARCHAR(191) NULL,
    `ville` VARCHAR(191) NULL,
    `region` VARCHAR(191) NULL,
    `capacite` DOUBLE NULL,
    `qteMin` DOUBLE NULL,
    `qteMax` DOUBLE NULL,
    `societeId` INTEGER NOT NULL,

    UNIQUE INDEX `Depot_code_societeId_key`(`code`, `societeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Emplacement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `libelle` VARCHAR(191) NOT NULL,
    `categorie` VARCHAR(191) NULL,
    `barcode` VARCHAR(191) NULL,
    `niveaux` INTEGER NULL,
    `depotId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Famille` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,

    UNIQUE INDEX `Famille_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SousFamille` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `familleId` INTEGER NOT NULL,

    UNIQUE INDEX `SousFamille_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Article` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `codeBarres` VARCHAR(191) NULL,
    `libelle` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `unite` VARCHAR(191) NOT NULL,
    `prixAchat` DOUBLE NOT NULL DEFAULT 0,
    `prixVente` DOUBLE NOT NULL DEFAULT 0,
    `stockMin` INTEGER NULL,
    `stockMax` INTEGER NULL,
    `modeGestion` VARCHAR(191) NOT NULL DEFAULT 'STANDARD',
    `actif` BOOLEAN NOT NULL DEFAULT true,
    `societeId` INTEGER NOT NULL,
    `familleId` INTEGER NULL,
    `sousFamilleId` INTEGER NULL,

    UNIQUE INDEX `Article_code_societeId_key`(`code`, `societeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Stock` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `articleId` INTEGER NOT NULL,
    `depotId` INTEGER NOT NULL,
    `emplacementId` INTEGER NULL,
    `quantite` DOUBLE NOT NULL DEFAULT 0,
    `quantiteMin` DOUBLE NULL,
    `quantiteMax` DOUBLE NULL,
    `qteReservee` DOUBLE NOT NULL DEFAULT 0,
    `coutStockage` DOUBLE NULL,
    `dateLastMvt` DATETIME(3) NULL,

    UNIQUE INDEX `Stock_articleId_depotId_emplacementId_key`(`articleId`, `depotId`, `emplacementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Mouvement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reference` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `articleId` INTEGER NOT NULL,
    `depotId` INTEGER NOT NULL,
    `depotDestId` INTEGER NULL,
    `quantite` DOUBLE NOT NULL,
    `valeur` DOUBLE NULL,
    `lotId` INTEGER NULL,
    `utilisateurId` INTEGER NOT NULL,
    `commentaire` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Mouvement_reference_key`(`reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `numero` VARCHAR(191) NOT NULL,
    `articleId` INTEGER NOT NULL,
    `dateFabrication` DATETIME(3) NULL,
    `dateExpiration` DATETIME(3) NULL,
    `quantiteInitiale` DOUBLE NOT NULL,
    `quantiteRestante` DOUBLE NOT NULL,
    `statut` VARCHAR(191) NOT NULL DEFAULT 'ACTIF',

    UNIQUE INDEX `Lot_numero_key`(`numero`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Fournisseur` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `adresse` VARCHAR(191) NULL,
    `telephone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `contact` VARCHAR(191) NULL,
    `tauxRemise` DOUBLE NULL,
    `delaiPayment` INTEGER NULL,
    `noteCredit` DOUBLE NULL,
    `societeId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Client` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `adresse` VARCHAR(191) NULL,
    `telephone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `plafondCredit` DOUBLE NULL,
    `encours` DOUBLE NOT NULL DEFAULT 0,
    `tauxRemise` DOUBLE NULL,
    `modePaiement` VARCHAR(191) NULL,
    `societeId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Achat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reference` VARCHAR(191) NOT NULL,
    `fournisseurId` INTEGER NOT NULL,
    `societeId` INTEGER NOT NULL,
    `dateCommande` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dateReception` DATETIME(3) NULL,
    `statut` VARCHAR(191) NOT NULL DEFAULT 'BROUILLON',
    `totalHT` DOUBLE NOT NULL DEFAULT 0,
    `totalTVA` DOUBLE NOT NULL DEFAULT 0,
    `totalTTC` DOUBLE NOT NULL DEFAULT 0,
    `remise` DOUBLE NOT NULL DEFAULT 0,

    UNIQUE INDEX `Achat_reference_key`(`reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LigneAchat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `achatId` INTEGER NOT NULL,
    `articleId` INTEGER NOT NULL,
    `quantite` DOUBLE NOT NULL,
    `prixUnit` DOUBLE NOT NULL,
    `remise` DOUBLE NOT NULL DEFAULT 0,
    `totalHT` DOUBLE NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reference` VARCHAR(191) NOT NULL,
    `clientId` INTEGER NOT NULL,
    `societeId` INTEGER NOT NULL,
    `dateVente` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dateLivraison` DATETIME(3) NULL,
    `statut` VARCHAR(191) NOT NULL DEFAULT 'BROUILLON',
    `totalHT` DOUBLE NOT NULL DEFAULT 0,
    `totalTVA` DOUBLE NOT NULL DEFAULT 0,
    `totalTTC` DOUBLE NOT NULL DEFAULT 0,
    `remise` DOUBLE NOT NULL DEFAULT 0,
    `modePaiement` VARCHAR(191) NULL,

    UNIQUE INDEX `Vente_reference_key`(`reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LigneVente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `venteId` INTEGER NOT NULL,
    `articleId` INTEGER NOT NULL,
    `quantite` DOUBLE NOT NULL,
    `prixUnit` DOUBLE NOT NULL,
    `remise` DOUBLE NOT NULL DEFAULT 0,
    `totalHT` DOUBLE NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Inventaire` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reference` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `statut` VARCHAR(191) NOT NULL DEFAULT 'EN_COURS',
    `depotId` INTEGER NOT NULL,

    UNIQUE INDEX `Inventaire_reference_key`(`reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LigneInventaire` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inventaireId` INTEGER NOT NULL,
    `articleId` INTEGER NOT NULL,
    `qteTheorique` DOUBLE NOT NULL,
    `qteReelle` DOUBLE NULL,
    `ecart` DOUBLE NULL,
    `valide` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Valorisation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `articleId` INTEGER NOT NULL,
    `methode` VARCHAR(191) NOT NULL,
    `valeurUnit` DOUBLE NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reglement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `venteId` INTEGER NOT NULL,
    `montant` DOUBLE NOT NULL,
    `datePayment` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reference` VARCHAR(191) NULL,
    `mode` VARCHAR(191) NOT NULL,
    `statut` VARCHAR(191) NOT NULL DEFAULT 'EN_ATTENTE',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Utilisateur` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nom` VARCHAR(191) NOT NULL,
    `prenom` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `motDePasse` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'MAGASINIER',
    `actif` BOOLEAN NOT NULL DEFAULT true,
    `societeId` INTEGER NOT NULL,

    UNIQUE INDEX `Utilisateur_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Audit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `utilisateurId` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `ancienneValeur` VARCHAR(191) NULL,
    `nouvelleValeur` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Depot` ADD CONSTRAINT `Depot_societeId_fkey` FOREIGN KEY (`societeId`) REFERENCES `Societe`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Emplacement` ADD CONSTRAINT `Emplacement_depotId_fkey` FOREIGN KEY (`depotId`) REFERENCES `Depot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SousFamille` ADD CONSTRAINT `SousFamille_familleId_fkey` FOREIGN KEY (`familleId`) REFERENCES `Famille`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Article` ADD CONSTRAINT `Article_societeId_fkey` FOREIGN KEY (`societeId`) REFERENCES `Societe`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Article` ADD CONSTRAINT `Article_familleId_fkey` FOREIGN KEY (`familleId`) REFERENCES `Famille`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Article` ADD CONSTRAINT `Article_sousFamilleId_fkey` FOREIGN KEY (`sousFamilleId`) REFERENCES `SousFamille`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Stock` ADD CONSTRAINT `Stock_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Stock` ADD CONSTRAINT `Stock_depotId_fkey` FOREIGN KEY (`depotId`) REFERENCES `Depot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Stock` ADD CONSTRAINT `Stock_emplacementId_fkey` FOREIGN KEY (`emplacementId`) REFERENCES `Emplacement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Mouvement` ADD CONSTRAINT `Mouvement_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Mouvement` ADD CONSTRAINT `Mouvement_depotId_fkey` FOREIGN KEY (`depotId`) REFERENCES `Depot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Mouvement` ADD CONSTRAINT `Mouvement_depotDestId_fkey` FOREIGN KEY (`depotDestId`) REFERENCES `Depot`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Mouvement` ADD CONSTRAINT `Mouvement_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `Lot`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Mouvement` ADD CONSTRAINT `Mouvement_utilisateurId_fkey` FOREIGN KEY (`utilisateurId`) REFERENCES `Utilisateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lot` ADD CONSTRAINT `Lot_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Fournisseur` ADD CONSTRAINT `Fournisseur_societeId_fkey` FOREIGN KEY (`societeId`) REFERENCES `Societe`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Client` ADD CONSTRAINT `Client_societeId_fkey` FOREIGN KEY (`societeId`) REFERENCES `Societe`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Achat` ADD CONSTRAINT `Achat_fournisseurId_fkey` FOREIGN KEY (`fournisseurId`) REFERENCES `Fournisseur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Achat` ADD CONSTRAINT `Achat_societeId_fkey` FOREIGN KEY (`societeId`) REFERENCES `Societe`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LigneAchat` ADD CONSTRAINT `LigneAchat_achatId_fkey` FOREIGN KEY (`achatId`) REFERENCES `Achat`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LigneAchat` ADD CONSTRAINT `LigneAchat_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vente` ADD CONSTRAINT `Vente_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vente` ADD CONSTRAINT `Vente_societeId_fkey` FOREIGN KEY (`societeId`) REFERENCES `Societe`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LigneVente` ADD CONSTRAINT `LigneVente_venteId_fkey` FOREIGN KEY (`venteId`) REFERENCES `Vente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LigneVente` ADD CONSTRAINT `LigneVente_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Inventaire` ADD CONSTRAINT `Inventaire_depotId_fkey` FOREIGN KEY (`depotId`) REFERENCES `Depot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LigneInventaire` ADD CONSTRAINT `LigneInventaire_inventaireId_fkey` FOREIGN KEY (`inventaireId`) REFERENCES `Inventaire`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LigneInventaire` ADD CONSTRAINT `LigneInventaire_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Valorisation` ADD CONSTRAINT `Valorisation_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reglement` ADD CONSTRAINT `Reglement_venteId_fkey` FOREIGN KEY (`venteId`) REFERENCES `Vente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Utilisateur` ADD CONSTRAINT `Utilisateur_societeId_fkey` FOREIGN KEY (`societeId`) REFERENCES `Societe`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Audit` ADD CONSTRAINT `Audit_utilisateurId_fkey` FOREIGN KEY (`utilisateurId`) REFERENCES `Utilisateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
