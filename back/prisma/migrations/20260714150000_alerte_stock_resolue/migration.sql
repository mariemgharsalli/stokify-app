-- AlterTable
ALTER TABLE `AlerteStock` ADD COLUMN `resolue` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `resolueAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `AlerteStock_societeId_resolue_createdAt_idx` ON `AlerteStock`(`societeId`, `resolue`, `createdAt`);
