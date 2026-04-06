-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "acessoOrionSuporte" BOOLEAN NOT NULL DEFAULT false;

-- Manter comportamento: quem já tinha pelo nível continua com acesso explícito no usuário
UPDATE "Usuario" u
SET "acessoOrionSuporte" = true
FROM "UsuarioNivel" n
WHERE u."nivelId" = n.id AND n."acessoOrionSuporte" = true;
