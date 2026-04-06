-- Órion Suporte no usuário: null = herdar do nível; true = garantir; false = bloquear (sobrepõe o nível).
ALTER TABLE "Usuario" ALTER COLUMN "acessoOrionSuporte" DROP DEFAULT;
ALTER TABLE "Usuario" ALTER COLUMN "acessoOrionSuporte" DROP NOT NULL;

UPDATE "Usuario" SET "acessoOrionSuporte" = NULL WHERE "acessoOrionSuporte" = false;
