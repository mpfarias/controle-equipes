-- AlterTable
ALTER TABLE "Policial" ADD COLUMN IF NOT EXISTS "restricaoMedicaHistoricoId" INTEGER;
ALTER TABLE "Policial" ADD COLUMN IF NOT EXISTS "restricaoMedicaDataInicio" TIMESTAMP(3);
ALTER TABLE "Policial" ADD COLUMN IF NOT EXISTS "restricaoMedicaDataFim" TIMESTAMP(3);
ALTER TABLE "Policial" ADD COLUMN IF NOT EXISTS "restricaoMedicaRemovidoPorId" INTEGER;
ALTER TABLE "Policial" ADD COLUMN IF NOT EXISTS "restricaoMedicaRemovidoPorNome" TEXT;
