-- CreateTable
CREATE TABLE "TipoRestricaoAfastamento" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TipoRestricaoAfastamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TipoRestricaoAfastamento_nome_key" ON "TipoRestricaoAfastamento"("nome");

-- Inserir registros iniciais
INSERT INTO "TipoRestricaoAfastamento" ("nome", "descricao", "createdAt", "updatedAt") VALUES
('Carnaval', 'Período do Carnaval', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('7 de setembro', 'Dia da Independência do Brasil', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('Mês de Dezembro', 'Todo o mês de dezembro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('Eleições', 'Período das eleições', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('Outro', 'Outros períodos especiais', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable: Adicionar tipoRestricaoId e ano, remover nome
ALTER TABLE "RestricaoAfastamento" ADD COLUMN "tipoRestricaoId" INTEGER;
ALTER TABLE "RestricaoAfastamento" ADD COLUMN "ano" INTEGER;

-- Atualizar registros existentes (se houver) para usar tipo "Outro"
DO $$
DECLARE
    outro_id INTEGER;
BEGIN
    SELECT id INTO outro_id FROM "TipoRestricaoAfastamento" WHERE nome = 'Outro';
    IF outro_id IS NOT NULL THEN
        UPDATE "RestricaoAfastamento" SET "tipoRestricaoId" = outro_id, "ano" = EXTRACT(YEAR FROM "dataInicio") WHERE "tipoRestricaoId" IS NULL;
    END IF;
END $$;

-- Tornar campos obrigatórios
ALTER TABLE "RestricaoAfastamento" ALTER COLUMN "tipoRestricaoId" SET NOT NULL;
ALTER TABLE "RestricaoAfastamento" ALTER COLUMN "ano" SET NOT NULL;

-- Remover coluna nome
ALTER TABLE "RestricaoAfastamento" DROP COLUMN IF EXISTS "nome";

-- AddForeignKey
ALTER TABLE "RestricaoAfastamento" ADD CONSTRAINT "RestricaoAfastamento_tipoRestricaoId_fkey" FOREIGN KEY ("tipoRestricaoId") REFERENCES "TipoRestricaoAfastamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
