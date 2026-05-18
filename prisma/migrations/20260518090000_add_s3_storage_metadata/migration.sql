-- AlterTable
ALTER TABLE `DownloadJob`
  ADD COLUMN `storageKey` TEXT NULL,
  ADD COLUMN `storageBucket` TEXT NULL,
  ADD COLUMN `storageProvider` TEXT NULL,
  ADD COLUMN `uploadedAt` DATETIME(3) NULL;
