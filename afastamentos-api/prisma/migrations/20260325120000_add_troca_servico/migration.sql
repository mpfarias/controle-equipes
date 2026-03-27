-- CreateEnum
CREATE TYPE "TrocaServicoStatus" AS ENUM ('ATIVA', 'CONCLUIDA', 'CANCELADA');

-- CreateTable
CREATE TABLE "TrocaServico" (
    "id" SERIAL NOT NULL,
    "policialAId" INTEGER NOT NULL,
    "policialBId" INTEGER NOT NULL,
    "equipeOrigemA" TEXT,
    "equipeOrigemB" TEXT,
    "dataServicoA" DATE NOT NULL,
    "dataServicoB" DATE NOT NULL,
    "restauradoA" BOOLEAN NOT NULL DEFAULT false,
    "restauradoB" BOOLEAN NOT NULL DEFAULT false,
    "status" "TrocaServicoStatus" NOT NULL DEFAULT 'ATIVA',
    "createdById" INTEGER,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrocaServico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrocaServico_status_idx" ON "TrocaServico"("status");

-- CreateIndex
CREATE INDEX "TrocaServico_policialAId_idx" ON "TrocaServico"("policialAId");

-- CreateIndex
CREATE INDEX "TrocaServico_policialBId_idx" ON "TrocaServico"("policialBId");

-- AddForeignKey
ALTER TABLE "TrocaServico" ADD CONSTRAINT "TrocaServico_policialAId_fkey" FOREIGN KEY ("policialAId") REFERENCES "Policial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrocaServico" ADD CONSTRAINT "TrocaServico_policialBId_fkey" FOREIGN KEY ("policialBId") REFERENCES "Policial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
