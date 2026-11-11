-- AlterTable
ALTER TABLE `Emplacement` ADD COLUMN `distanceQuai` INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN `capaciteSlots` INTEGER NULL;
