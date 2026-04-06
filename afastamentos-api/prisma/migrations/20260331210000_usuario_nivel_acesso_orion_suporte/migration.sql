-- AlterTable
ALTER TABLE "UsuarioNivel" ADD COLUMN IF NOT EXISTS "acessoOrionSuporte" BOOLEAN NOT NULL DEFAULT false;

-- Gestores que já administravam chamados no SAD mantêm acesso ao Órion Suporte
UPDATE "UsuarioNivel"
SET "acessoOrionSuporte" = true
WHERE UPPER("nome") IN ('ADMINISTRADOR', 'SAD');
