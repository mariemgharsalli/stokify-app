-- AlterTable: avatar base64 needs more than varchar(191)
ALTER TABLE `Utilisateur` MODIFY COLUMN `photoUrl` TEXT NULL;
