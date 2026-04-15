DO $$
BEGIN
  IF to_regclass('public."UsuarioNivel"') IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'UsuarioNivel' AND column_name = 'acessoOrionSuporte'
  ) THEN
    ALTER TABLE "UsuarioNivel" ADD COLUMN "acessoOrionSuporte" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Gestores que já administravam chamados no SAD mantêm acesso ao Órion Suporte
UPDATE "UsuarioNivel"
SET "acessoOrionSuporte" = true
WHERE UPPER("nome") IN ('ADMINISTRADOR', 'SAD');
