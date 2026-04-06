-- CreateEnum
CREATE TYPE "ErrorReportStatus" AS ENUM ('ABERTO', 'EM_ANALISE', 'RESOLVIDO', 'FECHADO');

-- CreateEnum
CREATE TYPE "ErrorReportCategoria" AS ENUM ('ERRO_SISTEMA', 'DUVIDA', 'MELHORIA', 'OUTRO');

-- CreateTable
CREATE TABLE "errorReport" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" "ErrorReportCategoria" NOT NULL,
    "status" "ErrorReportStatus" NOT NULL DEFAULT 'ABERTO',
    "acoes" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "errorReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "errorReport_usuarioId_idx" ON "errorReport"("usuarioId");

-- CreateIndex
CREATE INDEX "errorReport_status_idx" ON "errorReport"("status");

-- AddForeignKey
ALTER TABLE "errorReport" ADD CONSTRAINT "errorReport_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
