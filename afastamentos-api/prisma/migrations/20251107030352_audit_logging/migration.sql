-- AlterTable
ALTER TABLE `afastamento` ADD COLUMN `createdById` INTEGER NULL,
    ADD COLUMN `createdByName` VARCHAR(191) NULL,
    ADD COLUMN `updatedById` INTEGER NULL,
    ADD COLUMN `updatedByName` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `colaborador` ADD COLUMN `createdById` INTEGER NULL,
    ADD COLUMN `createdByName` VARCHAR(191) NULL,
    ADD COLUMN `updatedById` INTEGER NULL,
    ADD COLUMN `updatedByName` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `usuario` ADD COLUMN `createdById` INTEGER NULL,
    ADD COLUMN `createdByName` VARCHAR(191) NULL,
    ADD COLUMN `updatedById` INTEGER NULL,
    ADD COLUMN `updatedByName` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `entity` VARCHAR(191) NOT NULL,
    `entityId` INTEGER NULL,
    `action` ENUM('CREATE', 'UPDATE', 'DELETE') NOT NULL,
    `userId` INTEGER NULL,
    `userName` VARCHAR(191) NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
