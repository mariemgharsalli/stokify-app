-- AlterTable Marque: optional logo/image URL (uploaded via POST /api/marques/upload-image)
ALTER TABLE `Marque` ADD COLUMN `imageUrl` VARCHAR(191) NULL;
