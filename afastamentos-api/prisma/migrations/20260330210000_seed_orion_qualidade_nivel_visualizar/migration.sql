-- Permite ver o atalho Órion Qualidade no SAD para todos os níveis existentes (junto com ORION_QUALIDADE no usuário).
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
