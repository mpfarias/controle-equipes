-- Colunas legadas no Policial; só se a tabela já existir (deploys antigos).
DO $$
BEGIN
  IF to_regclass('public."Policial"') IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Policial' AND column_name = 'restricaoMedicaHistoricoId'
  ) THEN
    ALTER TABLE "Policial" ADD COLUMN "restricaoMedicaHistoricoId" INTEGER;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Policial' AND column_name = 'restricaoMedicaDataInicio'
  ) THEN
    ALTER TABLE "Policial" ADD COLUMN "restricaoMedicaDataInicio" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Policial' AND column_name = 'restricaoMedicaDataFim'
  ) THEN
    ALTER TABLE "Policial" ADD COLUMN "restricaoMedicaDataFim" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Policial' AND column_name = 'restricaoMedicaRemovidoPorId'
  ) THEN
    ALTER TABLE "Policial" ADD COLUMN "restricaoMedicaRemovidoPorId" INTEGER;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Policial' AND column_name = 'restricaoMedicaRemovidoPorNome'
  ) THEN
    ALTER TABLE "Policial" ADD COLUMN "restricaoMedicaRemovidoPorNome" TEXT;
  END IF;
END $$;
