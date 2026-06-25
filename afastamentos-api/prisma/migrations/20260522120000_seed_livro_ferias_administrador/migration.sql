-- Livro de Férias: permissão VISUALIZAR apenas para o nível ADMINISTRADOR.
-- Demais perfis devem ser liberados manualmente em Gestão do Sistema → Níveis de acesso.
DO $$
BEGIN
  IF to_regclass('public."UsuarioNivelPermissao"') IS NULL OR to_regclass('public."UsuarioNivel"') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO "UsuarioNivelPermissao" ("nivelId", "telaKey", "acao", "createdAt")
  SELECT n."id", 'livro-ferias', 'VISUALIZAR'::"PermissaoAcao", NOW()
  FROM "UsuarioNivel" n
  WHERE UPPER(TRIM(n."nome")) = 'ADMINISTRADOR'
    AND NOT EXISTS (
      SELECT 1
      FROM "UsuarioNivelPermissao" p
      WHERE p."nivelId" = n."id"
        AND p."telaKey" = 'livro-ferias'
        AND p."acao" = 'VISUALIZAR'::"PermissaoAcao"
    );
END $$;
