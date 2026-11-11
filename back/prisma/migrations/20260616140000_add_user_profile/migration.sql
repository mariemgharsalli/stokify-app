-- AlterTable: add only columns not yet present (profile fields partially existed)
ALTER TABLE `Utilisateur` ADD COLUMN `bio` TEXT NULL,
    ADD COLUMN `theme` VARCHAR(191) NULL DEFAULT 'dark',
    ADD COLUMN `lastLoginAt` DATETIME(3) NULL,
    ADD COLUMN `loginCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
