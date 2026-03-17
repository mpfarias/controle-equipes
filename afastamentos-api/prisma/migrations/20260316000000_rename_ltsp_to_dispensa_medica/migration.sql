-- Renomear motivo LTSP para Dispensa Médica
UPDATE "MotivoAfastamento"
SET "nome" = 'Dispensa Médica'
WHERE "nome" = 'LTSP';
