-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "funcaoId" INTEGER;

-- CreateTable
CREATE TABLE "Funcao" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Funcao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Funcao_nome_key" ON "Funcao"("nome");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "Funcao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
