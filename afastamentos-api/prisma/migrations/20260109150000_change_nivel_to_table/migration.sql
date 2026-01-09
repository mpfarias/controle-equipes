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
        WHERE table_name = 'Usuario' AND column_name = 'nivel'
        AND data_type = 'USER-DEFINED'
    ) THEN
        ALTER TABLE "Usuario" DROP COLUMN IF EXISTS "nivel";
    END IF;
END $$;

-- Add nivelId column
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "nivelId" INTEGER;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_nivelId_fkey" FOREIGN KEY ("nivelId") REFERENCES "UsuarioNivel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing data if any (set default to CONSULTAS level)
UPDATE "Usuario" 
SET "nivelId" = (SELECT "id" FROM "UsuarioNivel" WHERE "nome" = 'CONSULTAS' LIMIT 1)
WHERE "nivelId" IS NULL;

-- Drop enum type if exists
DO $$ 
BEGIN
    DROP TYPE IF EXISTS "UsuarioNivel" CASCADE;
EXCEPTION
    WHEN others THEN NULL;
END $$;
