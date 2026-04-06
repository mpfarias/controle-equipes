-- AlterTable
ALTER TABLE "errorReport" ADD COLUMN IF NOT EXISTS "anexoDataUrl" TEXT;
ALTER TABLE "errorReport" ADD COLUMN IF NOT EXISTS "anexoNome" VARCHAR(255);
