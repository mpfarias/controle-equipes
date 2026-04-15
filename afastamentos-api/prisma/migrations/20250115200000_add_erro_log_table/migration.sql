CREATE TABLE IF NOT EXISTS "ErroLog" (
    "id" SERIAL NOT NULL,
    "mensagem" TEXT NOT NULL,
    "stack" TEXT,
    "endpoint" TEXT,
    "metodo" TEXT,
    "userId" INTEGER,
    "userName" TEXT,
    "matricula" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "requestBody" JSONB,
    "statusCode" INTEGER,
    "erro" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErroLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ErroLog_createdAt_idx" ON "ErroLog"("createdAt");

CREATE INDEX IF NOT EXISTS "ErroLog_statusCode_idx" ON "ErroLog"("statusCode");
