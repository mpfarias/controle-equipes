-- Substitui o código legado PATRIMONIO por ORION_PATRIMONIO em sistemasPermitidos (sem duplicar entradas).
UPDATE "Usuario"
SET "sistemasPermitidos" = (
  SELECT COALESCE(array_agg(DISTINCT elem), ARRAY[]::text[])
  FROM unnest(
    array_replace("sistemasPermitidos", 'PATRIMONIO', 'ORION_PATRIMONIO')
  ) AS elem
)
WHERE 'PATRIMONIO' = ANY("sistemasPermitidos");
