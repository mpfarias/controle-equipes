-- Deploy inicial: migrations 20250118*/20* rodaram antes do init e não alteraram nada.
-- Após renomear Colaborador -> Policial, garante restricaoMedicaId + tabela de histórico (idempotente).
DO $$
BEGIN
  IF to_regclass('public."Policial"') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Policial' AND column_name = 'restricaoMedicaId'
  ) THEN
    ALTER TABLE "Policial" ADD COLUMN "restricaoMedicaId" INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Policial_restricaoMedicaId_fkey') THEN
    ALTER TABLE "Policial" ADD CONSTRAINT "Policial_restricaoMedicaId_fkey"
      FOREIGN KEY ("restricaoMedicaId") REFERENCES "RestricaoMedica"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'RestricaoMedicaHistorico') THEN
    CREATE TABLE "RestricaoMedicaHistorico" (
        "id" SERIAL NOT NULL,
        "policialId" INTEGER NOT NULL,
        "restricaoMedicaId" INTEGER NOT NULL,
        "dataInicio" TIMESTAMP(3) NOT NULL,
        "dataFim" TIMESTAMP(3) NOT NULL,
        "removidoPorId" INTEGER,
        "removidoPorNome" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "RestricaoMedicaHistorico_pkey" PRIMARY KEY ("id")
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RestricaoMedicaHistorico_policialId_fkey') THEN
    ALTER TABLE "RestricaoMedicaHistorico" ADD CONSTRAINT "RestricaoMedicaHistorico_policialId_fkey"
      FOREIGN KEY ("policialId") REFERENCES "Policial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RestricaoMedicaHistorico_restricaoMedicaId_fkey') THEN
    ALTER TABLE "RestricaoMedicaHistorico" ADD CONSTRAINT "RestricaoMedicaHistorico_restricaoMedicaId_fkey"
      FOREIGN KEY ("restricaoMedicaId") REFERENCES "RestricaoMedica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- Migração legada (só se as colunas antigas existirem — bases que passaram por 202501200000 antes do rename)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Policial' AND column_name = 'restricaoMedicaHistoricoId'
  ) THEN
    INSERT INTO "RestricaoMedicaHistorico" ("policialId", "restricaoMedicaId", "dataInicio", "dataFim", "removidoPorId", "removidoPorNome", "createdAt")
    SELECT
        "id" AS "policialId",
        "restricaoMedicaHistoricoId" AS "restricaoMedicaId",
        "restricaoMedicaDataInicio" AS "dataInicio",
        "restricaoMedicaDataFim" AS "dataFim",
        "restricaoMedicaRemovidoPorId" AS "removidoPorId",
        "restricaoMedicaRemovidoPorNome" AS "removidoPorNome",
        COALESCE("restricaoMedicaDataFim", CURRENT_TIMESTAMP) AS "createdAt"
    FROM "Policial"
    WHERE "restricaoMedicaHistoricoId" IS NOT NULL;

    ALTER TABLE "Policial" DROP COLUMN IF EXISTS "restricaoMedicaHistoricoId";
    ALTER TABLE "Policial" DROP COLUMN IF EXISTS "restricaoMedicaDataInicio";
    ALTER TABLE "Policial" DROP COLUMN IF EXISTS "restricaoMedicaDataFim";
    ALTER TABLE "Policial" DROP COLUMN IF EXISTS "restricaoMedicaRemovidoPorId";
    ALTER TABLE "Policial" DROP COLUMN IF EXISTS "restricaoMedicaRemovidoPorNome";
  END IF;
END $$;
