DO $$
BEGIN
  IF to_regclass('public."Usuario"') IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Usuario' AND column_name = 'acessoOrionSuporte'
  ) THEN
    ALTER TABLE "Usuario" ADD COLUMN "acessoOrionSuporte" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Manter comportamento: quem já tinha pelo nível continua com acesso explícito no usuário
UPDATE "Usuario" u
SET "acessoOrionSuporte" = true
FROM "UsuarioNivel" n
WHERE u."nivelId" = n.id AND n."acessoOrionSuporte" = true;
