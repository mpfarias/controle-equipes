-- Substitui o código legado PATRIMONIO_OPERACOES por PATRIMONIO e OPERACOES (sem duplicar)
UPDATE "Usuario" u
SET "sistemasPermitidos" = COALESCE(
  (
    SELECT array_agg(DISTINCT v)
    FROM (
      SELECT unnest_e AS v
      FROM unnest(array_remove(u."sistemasPermitidos", 'PATRIMONIO_OPERACOES')) AS unnest_e
      UNION ALL
      SELECT 'PATRIMONIO'::text
      WHERE 'PATRIMONIO_OPERACOES' = ANY (u."sistemasPermitidos")
      UNION ALL
      SELECT 'OPERACOES'::text
      WHERE 'PATRIMONIO_OPERACOES' = ANY (u."sistemasPermitidos")
    ) s(v)
  ),
  ARRAY[]::text[]
);
