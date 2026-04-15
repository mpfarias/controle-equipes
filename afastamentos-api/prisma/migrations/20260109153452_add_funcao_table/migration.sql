DO $$
BEGIN
  IF to_regclass('public."Usuario"') IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Usuario' AND column_name = 'funcaoId'
  ) THEN
    ALTER TABLE "Usuario" ADD COLUMN "funcaoId" INTEGER;
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Funcao" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Funcao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Funcao_nome_key" ON "Funcao"("nome");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Usuario_funcaoId_fkey') THEN
    ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "Funcao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
