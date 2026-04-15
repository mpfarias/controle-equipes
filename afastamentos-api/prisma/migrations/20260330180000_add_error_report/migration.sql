DO $$ BEGIN
    CREATE TYPE "ErrorReportStatus" AS ENUM ('ABERTO', 'EM_ANALISE', 'RESOLVIDO', 'FECHADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "ErrorReportCategoria" AS ENUM ('ERRO_SISTEMA', 'DUVIDA', 'MELHORIA', 'OUTRO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "errorReport" (
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

CREATE INDEX IF NOT EXISTS "errorReport_usuarioId_idx" ON "errorReport"("usuarioId");

CREATE INDEX IF NOT EXISTS "errorReport_status_idx" ON "errorReport"("status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'errorReport_usuarioId_fkey') THEN
    ALTER TABLE "errorReport" ADD CONSTRAINT "errorReport_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
