-- Alinha o banco ao modelo Prisma atual: tabela "Policial" (init antigo criava "Colaborador").
-- Deve rodar após 20260113222150 (funcao em Colaborador) e antes de qualquer migration que use "Policial".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Colaborador'
  ) THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Policial'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE "Afastamento" DROP CONSTRAINT IF EXISTS "Afastamento_colaboradorId_fkey";
  ALTER TABLE "Afastamento" RENAME COLUMN "colaboradorId" TO "policialId";

  ALTER TABLE "Colaborador" RENAME TO "Policial";

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'i' AND c.relname = 'Colaborador_matricula_key'
  ) THEN
    ALTER INDEX "Colaborador_matricula_key" RENAME TO "Policial_matricula_key";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Colaborador_pkey') THEN
    ALTER TABLE "Policial" RENAME CONSTRAINT "Colaborador_pkey" TO "Policial_pkey";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Colaborador_funcaoId_fkey') THEN
    ALTER TABLE "Policial" RENAME CONSTRAINT "Colaborador_funcaoId_fkey" TO "Policial_funcaoId_fkey";
  END IF;

  ALTER TABLE "Afastamento" ADD CONSTRAINT "Afastamento_policialId_fkey"
    FOREIGN KEY ("policialId") REFERENCES "Policial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END $$;
