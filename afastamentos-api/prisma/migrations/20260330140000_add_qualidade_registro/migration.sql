-- CreateEnum
CREATE TYPE "QualidadeRegistroStatus" AS ENUM ('ABERTO', 'EM_TRATAMENTO', 'ENCERRADO');

-- CreateTable
CREATE TABLE "qualidade_registro" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "QualidadeRegistroStatus" NOT NULL DEFAULT 'ABERTO',
    "criadoPorId" INTEGER NOT NULL,
    "criadoPorNome" TEXT NOT NULL,
    "atualizadoPorId" INTEGER,
    "atualizadoPorNome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qualidade_registro_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "qualidade_registro_criadoPorId_idx" ON "qualidade_registro"("criadoPorId");

CREATE INDEX "qualidade_registro_status_idx" ON "qualidade_registro"("status");

ALTER TABLE "qualidade_registro" ADD CONSTRAINT "qualidade_registro_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
