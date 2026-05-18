-- AlterTable
ALTER TABLE `analysis` ADD COLUMN `nicheAnalysis` TEXT NULL,
    ADD COLUMN `nicheFocus` TEXT NULL,
    ADD COLUMN `nicheMaxDurationSec` INTEGER NULL,
    ADD COLUMN `nicheMinDurationSec` INTEGER NULL;
