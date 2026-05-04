ALTER TABLE "Policial"
ADD COLUMN "restricaoMedicaDataInicio" TIMESTAMP(3),
ADD COLUMN "restricaoMedicaDataFim" TIMESTAMP(3),
ADD COLUMN "restricaoMedicaPermanente" BOOLEAN NOT NULL DEFAULT false;

-- Backfill inicial para não perder contexto da restrição já ativa em produção:
-- usa `updatedAt` como aproximação de início quando há restrição ativa.
UPDATE "Policial"
SET "restricaoMedicaDataInicio" = "updatedAt"
WHERE "restricaoMedicaId" IS NOT NULL
  AND "restricaoMedicaDataInicio" IS NULL;
