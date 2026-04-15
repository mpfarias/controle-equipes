-- A tabela "Policial" só existe após init + rename (antes era "Colaborador").
-- Em deploy inicial, esta migration roda antes do init: não faz nada até a tabela existir.
DO $$
BEGIN
  IF to_regclass('public."Policial"') IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Policial' AND column_name = 'restricaoMedicaId'
  ) THEN
    RETURN;
  END IF;
  ALTER TABLE "Policial" ADD COLUMN "restricaoMedicaId" INTEGER;
  ALTER TABLE "Policial" ADD CONSTRAINT "Policial_restricaoMedicaId_fkey" FOREIGN KEY ("restricaoMedicaId") REFERENCES "RestricaoMedica"("id") ON DELETE SET NULL ON UPDATE CASCADE;
END $$;
