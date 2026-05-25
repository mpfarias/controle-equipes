-- Superior de dia: equipe obrigatória (A–E) para rotação 12×24; vínculo no cadastro da função.
UPDATE "Funcao"
SET
  "escalaOperacional" = false,
  "escalaMotorista" = false,
  "escalaExpediente" = false,
  "vinculoEquipe" = 'OBRIGATORIA',
  "ativo" = true
WHERE
  UPPER(TRIM("nome")) LIKE '%SUPERIOR%'
  AND UPPER(TRIM("nome")) LIKE '%DIA%';

UPDATE "Policial" p
SET "equipe" = 'A'
WHERE UPPER(p."nome") LIKE '%MARCOS%SILVA%'
  AND EXISTS (
    SELECT 1 FROM "Funcao" f
    WHERE f.id = p."funcaoId"
      AND UPPER(f."nome") LIKE '%SUPERIOR%' AND UPPER(f."nome") LIKE '%DIA%'
  );

UPDATE "Policial" p
SET "equipe" = 'B'
WHERE (
  UPPER(p."nome") LIKE '%CASTILHO%'
  OR UPPER(p."nome") LIKE '%EUDE%CASTILHO%'
)
AND EXISTS (
  SELECT 1 FROM "Funcao" f
  WHERE f.id = p."funcaoId"
    AND UPPER(f."nome") LIKE '%SUPERIOR%' AND UPPER(f."nome") LIKE '%DIA%'
);

UPDATE "Policial" p
SET "equipe" = 'C'
WHERE UPPER(p."nome") LIKE '%IZAI%'
  AND EXISTS (
    SELECT 1 FROM "Funcao" f
    WHERE f.id = p."funcaoId"
      AND UPPER(f."nome") LIKE '%SUPERIOR%' AND UPPER(f."nome") LIKE '%DIA%'
  );

UPDATE "Policial" p
SET "equipe" = 'D'
WHERE UPPER(p."nome") LIKE '%JOEL%'
  AND EXISTS (
    SELECT 1 FROM "Funcao" f
    WHERE f.id = p."funcaoId"
      AND UPPER(f."nome") LIKE '%SUPERIOR%' AND UPPER(f."nome") LIKE '%DIA%'
  );

UPDATE "Policial" p
SET "equipe" = 'E'
WHERE (
  UPPER(p."nome") LIKE '%MONCAO%'
  OR UPPER(p."nome") LIKE '%MONÇÃO%'
  OR UPPER(p."nome") LIKE '%VIEIRA MON%'
)
AND EXISTS (
  SELECT 1 FROM "Funcao" f
  WHERE f.id = p."funcaoId"
    AND UPPER(f."nome") LIKE '%SUPERIOR%' AND UPPER(f."nome") LIKE '%DIA%'
);
