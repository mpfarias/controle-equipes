-- Colaborador.funcaoId + FK (sem IF NOT EXISTS no ALTER: PG antigo / parser não aceita)
DO $$
BEGIN
  IF to_regclass('public."Colaborador"') IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Colaborador' AND column_name = 'funcaoId'
  ) THEN
    ALTER TABLE "Colaborador" ADD COLUMN "funcaoId" INTEGER;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."Colaborador"') IS NULL OR to_regclass('public."Funcao"') IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Colaborador_funcaoId_fkey') THEN
    ALTER TABLE "Colaborador" ADD CONSTRAINT "Colaborador_funcaoId_fkey"
      FOREIGN KEY ("funcaoId") REFERENCES "Funcao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
