-- Foreign keys (ignore errors if already present via app retry)
ALTER TABLE `Panier` ADD CONSTRAINT `Panier_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Panier` ADD CONSTRAINT `Panier_societeId_fkey` FOREIGN KEY (`societeId`) REFERENCES `Societe`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `LignePanier` ADD CONSTRAINT `LignePanier_panierId_fkey` FOREIGN KEY (`panierId`) REFERENCES `Panier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LignePanier` ADD CONSTRAINT `LignePanier_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CommandeClient` ADD CONSTRAINT `CommandeClient_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CommandeClient` ADD CONSTRAINT `CommandeClient_societeId_fkey` FOREIGN KEY (`societeId`) REFERENCES `Societe`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `LigneCommandeClient` ADD CONSTRAINT `LigneCommandeClient_commandeId_fkey` FOREIGN KEY (`commandeId`) REFERENCES `CommandeClient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LigneCommandeClient` ADD CONSTRAINT `LigneCommandeClient_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
