-- Unicité du code d'emplacement par dépôt
--
-- Vérification préalable :
-- SELECT `code`, `depotId`, COUNT(*) AS cnt
-- FROM `Emplacement`
-- GROUP BY `code`, `depotId`
-- HAVING cnt > 1;

-- Corriger les doublons existants : conserver le plus petit id, suffixer les autres avec -<id>
UPDATE `Emplacement` e
INNER JOIN (
  SELECT `id`,
         ROW_NUMBER() OVER (PARTITION BY `code`, `depotId` ORDER BY `id`) AS rn
  FROM `Emplacement`
) d ON d.`id` = e.`id`
SET e.`code` = CONCAT(e.`code`, '-', e.`id`)
WHERE d.rn > 1;

CREATE UNIQUE INDEX `Emplacement_code_depotId_key` ON `Emplacement`(`code`, `depotId`);
