-- Permite ver o atalho Órion Qualidade no SAD para todos os níveis existentes (junto com ORION_QUALIDADE no usuário).
DO $$
BEGIN
  IF to_regclass('public."UsuarioNivelPermissao"') IS NULL OR to_regclass('public."UsuarioNivel"') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO "UsuarioNivelPermissao" ("nivelId", "telaKey", "acao", "createdAt")
  SELECT n."id", 'orion-qualidade', 'VISUALIZAR'::"PermissaoAcao", NOW()
  FROM "UsuarioNivel" n
  WHERE NOT EXISTS (
    SELECT 1
    FROM "UsuarioNivelPermissao" p
    WHERE p."nivelId" = n."id"
      AND p."telaKey" = 'orion-qualidade'
      AND p."acao" = 'VISUALIZAR'::"PermissaoAcao"
  );
END $$;
