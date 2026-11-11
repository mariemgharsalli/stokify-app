-- Unicité du code client / fournisseur par société
--
-- IMPORTANT : vérifier l'absence de doublons existants en base avant d'appliquer
-- cette migration (sinon elle échouera).
--
-- Vérification préalable Client :
-- SELECT `code`, `societeId`, COUNT(*) AS cnt
-- FROM `Client`
-- GROUP BY `code`, `societeId`
-- HAVING cnt > 1;
--
-- Vérification préalable Fournisseur :
-- SELECT `code`, `societeId`, COUNT(*) AS cnt
-- FROM `Fournisseur`
-- GROUP BY `code`, `societeId`
-- HAVING cnt > 1;

CREATE UNIQUE INDEX `Client_code_societeId_key` ON `Client`(`code`, `societeId`);
CREATE UNIQUE INDEX `Fournisseur_code_societeId_key` ON `Fournisseur`(`code`, `societeId`);
