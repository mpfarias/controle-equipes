-- Upgrade raro: enum "UsuarioNivel" legado impede criar a tabela com o mesmo nome
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'UsuarioNivel' AND t.typtype = 'e'
  ) THEN
    ALTER TABLE "Usuario" DROP COLUMN IF EXISTS "nivel";
    DROP TYPE "UsuarioNivel" CASCADE;
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "UsuarioNivel" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsuarioNivel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UsuarioNivel_nome_key" ON "UsuarioNivel"("nome");

-- Populate initial levels
INSERT INTO "UsuarioNivel" ("nome", "descricao", "createdAt", "updatedAt") VALUES
('ADMINISTRADOR', 'Acesso completo ao sistema', NOW(), NOW()),
('GESTOR', 'Acesso para gestão de dados', NOW(), NOW()),
('CONSULTAS', 'Acesso apenas para consultas', NOW(), NOW())
ON CONFLICT ("nome") DO NOTHING;

-- Drop enum column if exists (from previous migration)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Usuario' AND column_name = 'nivel'
        AND data_type = 'USER-DEFINED'
    ) THEN
        ALTER TABLE "Usuario" DROP COLUMN IF EXISTS "nivel";
    END IF;
END $$;

-- Add nivelId column (sem ADD COLUMN IF NOT EXISTS: PG < 9.6)
DO $$
BEGIN
  IF to_regclass('public."Usuario"') IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Usuario' AND column_name = 'nivelId'
  ) THEN
    ALTER TABLE "Usuario" ADD COLUMN "nivelId" INTEGER;
  END IF;
END $$;

-- AddForeignKey (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Usuario_nivelId_fkey') THEN
    ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_nivelId_fkey" FOREIGN KEY ("nivelId") REFERENCES "UsuarioNivel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Migrate existing data if any (set default to CONSULTAS level)
UPDATE "Usuario"
SET "nivelId" = (SELECT "id" FROM "UsuarioNivel" WHERE "nome" = 'CONSULTAS' LIMIT 1)
WHERE "nivelId" IS NULL;

-- Remove apenas o enum legado "UsuarioNivel" (typtype = e). Nunca DROP do tipo composto (c) da tabela homônima.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'UsuarioNivel' AND t.typtype = 'e'
  ) THEN
    DROP TYPE "UsuarioNivel" CASCADE;
  END IF;
END $$;
