-- Configura função Guarda COPOM e fases PAR/IMPAR (âncora 18/05/2026 — Manoel PAR).
UPDATE "Funcao"
SET
  "escalaOperacional" = false,
  "escalaMotorista" = false,
  "escalaExpediente" = true,
  "expedienteHorarioPreset" = 'GUARDA_COPOM_12X36',
  "vinculoEquipe" = 'SEM_EQUIPE',
  "ativo" = true
WHERE
  UPPER(TRIM("nome")) LIKE '%GUARDA%'
  AND UPPER(TRIM("nome")) LIKE '%COPOM%';

UPDATE "Policial" p
SET "expediente12x36Fase" = 'PAR'
FROM "Funcao" f
WHERE
  p."funcaoId" = f.id
  AND f."expedienteHorarioPreset" = 'GUARDA_COPOM_12X36'
  AND UPPER(p."nome") LIKE '%MANOEL PEREIRA DOS SANTOS%';

UPDATE "Policial" p
SET "expediente12x36Fase" = 'IMPAR'
FROM "Funcao" f
WHERE
  p."funcaoId" = f.id
  AND f."expedienteHorarioPreset" = 'GUARDA_COPOM_12X36'
  AND UPPER(p."nome") LIKE '%EDILSON PEREIRA DE ALMEIDA%';
