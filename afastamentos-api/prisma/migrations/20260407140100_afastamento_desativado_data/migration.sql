-- Após o commit do ADD VALUE 'DESATIVADO': classificar histórico e limpar auditoria em encerramentos automáticos
UPDATE "Afastamento"
SET status = 'DESATIVADO'
WHERE status = 'ENCERRADO'
  AND (
    ("desativadoPorNome" IS NOT NULL AND TRIM("desativadoPorNome") <> '' AND "desativadoPorNome" <> 'Sistema')
    OR "desativadoPorId" IS NOT NULL
  );

UPDATE "Afastamento"
SET
  "desativadoPorId" = NULL,
  "desativadoPorNome" = NULL,
  "desativadoEm" = NULL
WHERE status = 'ENCERRADO';
