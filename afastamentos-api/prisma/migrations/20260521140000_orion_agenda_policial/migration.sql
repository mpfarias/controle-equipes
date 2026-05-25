-- Vínculo opcional com policial do efetivo COPOM (tabela Policial do SAD).
ALTER TABLE "orion_agenda_compromisso"
  ADD COLUMN IF NOT EXISTS "policialId" INTEGER,
  ADD COLUMN IF NOT EXISTS "responsavelNome" VARCHAR(200);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orion_agenda_compromisso_policialId_fkey'
  ) THEN
    ALTER TABLE "orion_agenda_compromisso"
      ADD CONSTRAINT "orion_agenda_compromisso_policialId_fkey"
      FOREIGN KEY ("policialId") REFERENCES "Policial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "orion_agenda_compromisso_policialId_idx"
  ON "orion_agenda_compromisso"("policialId");
