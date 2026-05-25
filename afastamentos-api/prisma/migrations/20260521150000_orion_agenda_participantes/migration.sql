CREATE TABLE IF NOT EXISTS "orion_agenda_compromisso_participante" (
  "id" SERIAL NOT NULL,
  "compromissoId" INTEGER NOT NULL,
  "policialId" INTEGER NOT NULL,
  "policialNome" VARCHAR(200) NOT NULL,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "orion_agenda_compromisso_participante_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orion_agenda_compromisso_participante_compromissoId_fkey'
  ) THEN
    ALTER TABLE "orion_agenda_compromisso_participante"
      ADD CONSTRAINT "orion_agenda_compromisso_participante_compromissoId_fkey"
      FOREIGN KEY ("compromissoId") REFERENCES "orion_agenda_compromisso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orion_agenda_compromisso_participante_policialId_fkey'
  ) THEN
    ALTER TABLE "orion_agenda_compromisso_participante"
      ADD CONSTRAINT "orion_agenda_compromisso_participante_policialId_fkey"
      FOREIGN KEY ("policialId") REFERENCES "Policial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "orion_agenda_compromisso_participante_compromissoId_policialId_key"
  ON "orion_agenda_compromisso_participante"("compromissoId", "policialId");

CREATE INDEX IF NOT EXISTS "orion_agenda_compromisso_participante_compromissoId_idx"
  ON "orion_agenda_compromisso_participante"("compromissoId");

CREATE INDEX IF NOT EXISTS "orion_agenda_compromisso_participante_policialId_idx"
  ON "orion_agenda_compromisso_participante"("policialId");
