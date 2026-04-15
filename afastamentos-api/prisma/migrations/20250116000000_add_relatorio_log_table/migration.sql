CREATE TABLE IF NOT EXISTS "RelatorioLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "userName" TEXT,
    "matricula" TEXT,
    "tipoRelatorio" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelatorioLog_pkey" PRIMARY KEY ("id")
);
