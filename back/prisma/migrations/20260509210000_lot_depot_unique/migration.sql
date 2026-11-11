-- Lot: emplacement par dépôt + unicité (article, numéro, dépôt)
-- Prérequis : chaque société ayant au moins un lot doit avoir au moins un dépôt.

-- 1) Colonne dépôt (nullable le temps du backfill)
ALTER TABLE `Lot` ADD COLUMN `depotId` INTEGER NULL;

-- 2) Renseigner depuis les mouvements déjà liés au lot
UPDATE `Lot` l
INNER JOIN (
    SELECT `lotId`, MIN(`depotId`) AS d
    FROM `Mouvement`
    WHERE `lotId` IS NOT NULL
    GROUP BY `lotId`
) m ON m.`lotId` = l.`id`
SET l.`depotId` = m.d;

-- 3) Lots sans mouvement : premier dépôt de la société de l’article
UPDATE `Lot` l
INNER JOIN `Article` a ON a.`id` = l.`articleId`
SET l.`depotId` = (
    SELECT MIN(d.`id`) FROM `Depot` d WHERE d.`societeId` = a.`societeId`
)
WHERE l.`depotId` IS NULL;

-- 4) Obligatoire pour le modèle applicatif
ALTER TABLE `Lot` MODIFY `depotId` INTEGER NOT NULL;

-- 5) Contrainte FK
ALTER TABLE `Lot` ADD CONSTRAINT `Lot_depotId_fkey` FOREIGN KEY (`depotId`) REFERENCES `Depot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6) Ancienne unicité globale du numéro de lot
DROP INDEX `Lot_numero_key` ON `Lot`;

-- 7) Nouvelle unicité métier
CREATE UNIQUE INDEX `Lot_articleId_numero_depotId_key` ON `Lot`(`articleId`, `numero`, `depotId`);
