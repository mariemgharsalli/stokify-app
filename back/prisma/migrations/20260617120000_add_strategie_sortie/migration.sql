-- strategieSortie may already exist from a prior schema push
ALTER TABLE `Article` MODIFY COLUMN `strategieSortie` VARCHAR(191) NOT NULL DEFAULT 'FIFO';
