-- CreateTable
CREATE TABLE "AcessoLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "userName" TEXT,
    "matricula" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "dataEntrada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataSaida" TIMESTAMP(3),
    "tempoSessao" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcessoLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcessoLog_dataEntrada_idx" ON "AcessoLog"("dataEntrada");

-- CreateIndex
CREATE INDEX "AcessoLog_userId_idx" ON "AcessoLog"("userId");
