-- CreateEnum
CREATE TYPE "PatrimonioBemSituacao" AS ENUM ('EM_USO', 'GUARDADO', 'MANUTENCAO', 'EMPRESTADO', 'BAIXADO');

-- CreateTable
CREATE TABLE "patrimonio_bem" (
    "id" SERIAL NOT NULL,
    "tombamento" VARCHAR(64) NOT NULL,
    "descricao" VARCHAR(500) NOT NULL,
    "categoria" VARCHAR(120),
    "marca" VARCHAR(120),
    "modelo" VARCHAR(120),
    "numeroSerie" VARCHAR(120),
    "localizacaoSetor" VARCHAR(200),
    "situacao" "PatrimonioBemSituacao" NOT NULL DEFAULT 'EM_USO',
    "observacoes" TEXT,
    "dataAquisicao" DATE,
    "valorAquisicao" DECIMAL(14,2),
    "criadoPorId" INTEGER NOT NULL,
    "criadoPorNome" VARCHAR(200) NOT NULL,
    "atualizadoPorId" INTEGER,
    "atualizadoPorNome" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patrimonio_bem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patrimonio_bem_tombamento_key" ON "patrimonio_bem"("tombamento");

-- CreateIndex
CREATE INDEX "patrimonio_bem_situacao_idx" ON "patrimonio_bem"("situacao");

-- CreateIndex
CREATE INDEX "patrimonio_bem_criadoPorId_idx" ON "patrimonio_bem"("criadoPorId");

-- CreateIndex
CREATE INDEX "patrimonio_bem_tombamento_idx" ON "patrimonio_bem"("tombamento");

-- AddForeignKey
ALTER TABLE "patrimonio_bem" ADD CONSTRAINT "patrimonio_bem_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
