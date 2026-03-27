-- Unifica o motivo duplicado "Dispensa médica" (id 14) no canônico "Dispensa Médica" (id 4).

UPDATE "Afastamento" SET "motivoId" = 4 WHERE "motivoId" = 14;

UPDATE "RestricaoAfastamento"
SET "motivosRestritos" = (
  SELECT COALESCE(array_agg(DISTINCT elem ORDER BY elem), ARRAY[]::integer[])
  FROM unnest(array_replace("motivosRestritos", 14, 4)) AS t(elem)
)
WHERE 14 = ANY("motivosRestritos");

DELETE FROM "MotivoAfastamento" WHERE id = 14;
