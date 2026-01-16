-- Add required SEI number to Afastamento
ALTER TABLE "Afastamento"
ADD COLUMN "seiNumero" TEXT NOT NULL DEFAULT '0';

ALTER TABLE "Afastamento"
ALTER COLUMN "seiNumero" DROP DEFAULT;
