CREATE TABLE IF NOT EXISTS "AcessoLog" (
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

CREATE INDEX IF NOT EXISTS "AcessoLog_dataEntrada_idx" ON "AcessoLog"("dataEntrada");

CREATE INDEX IF NOT EXISTS "AcessoLog_userId_idx" ON "AcessoLog"("userId");
