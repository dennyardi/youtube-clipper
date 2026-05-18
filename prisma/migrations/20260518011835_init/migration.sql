-- CreateTable
CREATE TABLE `Setting` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `openaiModel` VARCHAR(191) NOT NULL DEFAULT 'gpt-5.2',
    `analysisMode` ENUM('HYBRID', 'FULL_AI') NOT NULL DEFAULT 'HYBRID',
    `maxAiCandidates` INTEGER NOT NULL DEFAULT 40,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromptPreset` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `prompt` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PromptPreset_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Analysis` (
    `id` VARCHAR(191) NOT NULL,
    `youtubeUrl` TEXT NOT NULL,
    `videoId` VARCHAR(191) NOT NULL,
    `videoTitle` TEXT NULL,
    `type` ENUM('LONG', 'SHORT') NOT NULL,
    `language` VARCHAR(191) NOT NULL,
    `targetDuration` INTEGER NOT NULL,
    `minClipCount` INTEGER NOT NULL,
    `minDurationSec` INTEGER NULL,
    `maxDurationSec` INTEGER NULL,
    `presetId` INTEGER NULL,
    `analysisMode` ENUM('HYBRID', 'FULL_AI') NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `progress` INTEGER NOT NULL DEFAULT 0,
    `progressText` TEXT NULL,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClipResult` (
    `id` VARCHAR(191) NOT NULL,
    `analysisId` VARCHAR(191) NOT NULL,
    `title` TEXT NULL,
    `reason` TEXT NOT NULL,
    `startSecond` DOUBLE NOT NULL,
    `endSecond` DOUBLE NOT NULL,
    `duration` DOUBLE NOT NULL,
    `hookStart` DOUBLE NULL,
    `hookEnd` DOUBLE NULL,
    `hookReason` TEXT NULL,
    `transcript` LONGTEXT NULL,
    `score` DOUBLE NULL,
    `filePath` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ErrorLog` (
    `id` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `stack` LONGTEXT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Analysis` ADD CONSTRAINT `Analysis_presetId_fkey` FOREIGN KEY (`presetId`) REFERENCES `PromptPreset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClipResult` ADD CONSTRAINT `ClipResult_analysisId_fkey` FOREIGN KEY (`analysisId`) REFERENCES `Analysis`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
