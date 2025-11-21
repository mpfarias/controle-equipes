/*
  Warnings:

  - You are about to alter the column `status` on the `afastamento` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(1))` to `Enum(EnumId(1))`.

*/
-- AlterTable
ALTER TABLE `afastamento` MODIFY `status` ENUM('ATIVO', 'ENCERRADO') NOT NULL DEFAULT 'ATIVO';
