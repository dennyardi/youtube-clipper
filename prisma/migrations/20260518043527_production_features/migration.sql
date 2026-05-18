-- AlterTable
ALTER TABLE `ClipResult` ADD COLUMN `caption` TEXT NULL,
    ADD COLUMN `hashtags` TEXT NULL;

-- CreateTable
CREATE TABLE `TranscriptSegment` (
    `id` VARCHAR(191) NOT NULL,
    `analysisId` VARCHAR(191) NOT NULL,
    `startSecond` DOUBLE NOT NULL,
    `endSecond` DOUBLE NOT NULL,
    `text` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DownloadJob` (
    `id` VARCHAR(191) NOT NULL,
    `analysisId` VARCHAR(191) NOT NULL,
    `clipId` VARCHAR(191) NULL,
    `hookId` VARCHAR(191) NULL,
    `type` ENUM('CLIP', 'HOOK') NOT NULL,
    `mode` ENUM('FAST', 'PRECISE') NOT NULL DEFAULT 'FAST',
    `burnSubtitle` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `progressText` TEXT NULL,
    `errorMessage` TEXT NULL,
    `filePath` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TranscriptSegment` ADD CONSTRAINT `TranscriptSegment_analysisId_fkey` FOREIGN KEY (`analysisId`) REFERENCES `Analysis`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DownloadJob` ADD CONSTRAINT `DownloadJob_analysisId_fkey` FOREIGN KEY (`analysisId`) REFERENCES `Analysis`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DownloadJob` ADD CONSTRAINT `DownloadJob_clipId_fkey` FOREIGN KEY (`clipId`) REFERENCES `ClipResult`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DownloadJob` ADD CONSTRAINT `DownloadJob_hookId_fkey` FOREIGN KEY (`hookId`) REFERENCES `ClipHook`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
