CREATE TABLE IF NOT EXISTS "TipoRestricaoAfastamento" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TipoRestricaoAfastamento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TipoRestricaoAfastamento_nome_key" ON "TipoRestricaoAfastamento"("nome");

INSERT INTO "TipoRestricaoAfastamento" ("nome", "descricao", "createdAt", "updatedAt") VALUES
('Carnaval', 'Período do Carnaval', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('7 de setembro', 'Dia da Independência do Brasil', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('Mês de Dezembro', 'Todo o mês de dezembro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('Eleições', 'Período das eleições', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('Outro', 'Outros períodos especiais', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("nome") DO NOTHING;

ALTER TABLE "RestricaoAfastamento" ADD COLUMN IF NOT EXISTS "tipoRestricaoId" INTEGER;
ALTER TABLE "RestricaoAfastamento" ADD COLUMN IF NOT EXISTS "ano" INTEGER;

DO $$
DECLARE
    outro_id INTEGER;
BEGIN
    SELECT id INTO outro_id FROM "TipoRestricaoAfastamento" WHERE nome = 'Outro';
    IF outro_id IS NOT NULL THEN
        UPDATE "RestricaoAfastamento" SET "tipoRestricaoId" = outro_id, "ano" = EXTRACT(YEAR FROM "dataInicio") WHERE "tipoRestricaoId" IS NULL;
    END IF;
END $$;

ALTER TABLE "RestricaoAfastamento" ALTER COLUMN "tipoRestricaoId" SET NOT NULL;
ALTER TABLE "RestricaoAfastamento" ALTER COLUMN "ano" SET NOT NULL;

ALTER TABLE "RestricaoAfastamento" DROP COLUMN IF EXISTS "nome";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RestricaoAfastamento_tipoRestricaoId_fkey') THEN
    ALTER TABLE "RestricaoAfastamento" ADD CONSTRAINT "RestricaoAfastamento_tipoRestricaoId_fkey" FOREIGN KEY ("tipoRestricaoId") REFERENCES "TipoRestricaoAfastamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
