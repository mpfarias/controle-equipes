-- Tabela de permissões por nível (SAD). Deve rodar antes de 20260330210000_seed_orion_qualidade_nivel_visualizar.

DO $$ BEGIN
    CREATE TYPE "PermissaoAcao" AS ENUM ('VISUALIZAR', 'EDITAR', 'DESATIVAR', 'EXCLUIR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "UsuarioNivelPermissao" (
    "id" SERIAL NOT NULL,
    "nivelId" INTEGER NOT NULL,
    "telaKey" TEXT NOT NULL,
    "acao" "PermissaoAcao" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsuarioNivelPermissao_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'i' AND c.relname = 'UsuarioNivelPermissao_nivelId_telaKey_acao_key'
  ) THEN
    CREATE UNIQUE INDEX "UsuarioNivelPermissao_nivelId_telaKey_acao_key"
      ON "UsuarioNivelPermissao"("nivelId", "telaKey", "acao");
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."UsuarioNivel"') IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UsuarioNivelPermissao_nivelId_fkey') THEN
    ALTER TABLE "UsuarioNivelPermissao" ADD CONSTRAINT "UsuarioNivelPermissao_nivelId_fkey"
      FOREIGN KEY ("nivelId") REFERENCES "UsuarioNivel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
