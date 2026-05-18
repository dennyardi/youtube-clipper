-- AlterTable
ALTER TABLE `Analysis` ADD COLUMN `hookCount` INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE `ClipHook` (
    `id` VARCHAR(191) NOT NULL,
    `clipId` VARCHAR(191) NOT NULL,
    `title` TEXT NULL,
    `reason` TEXT NULL,
    `startSecond` DOUBLE NOT NULL,
    `endSecond` DOUBLE NOT NULL,
    `duration` DOUBLE NOT NULL,
    `filePath` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ClipHook` ADD CONSTRAINT `ClipHook_clipId_fkey` FOREIGN KEY (`clipId`) REFERENCES `ClipResult`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
