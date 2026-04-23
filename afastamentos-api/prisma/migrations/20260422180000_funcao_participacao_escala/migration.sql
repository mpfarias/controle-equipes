-- Participação da função nas gerações de escala (operacional 12×24, motoristas 24×72, expediente).

ALTER TABLE "Funcao" ADD COLUMN "escalaOperacional" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Funcao" ADD COLUMN "escalaMotorista" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Funcao" ADD COLUMN "escalaExpediente" BOOLEAN NOT NULL DEFAULT false;

-- Motoristas: não entram no operacional; entram só no bloco Motoristas.
UPDATE "Funcao"
SET "escalaOperacional" = false, "escalaMotorista" = true
WHERE UPPER("nome") LIKE '%MOTORISTA%';

-- Expediente administrativo / comando (mesmo critério amplamente usado no front).
UPDATE "Funcao"
SET "escalaExpediente" = true
WHERE (UPPER("nome") LIKE '%EXPEDIENTE%' AND UPPER("nome") LIKE '%ADM%')
   OR (UPPER("nome") LIKE '%SUBCMT%' AND UPPER("nome") LIKE '%UPM%')
   OR (UPPER("nome") LIKE '%SUBTCMT%' AND UPPER("nome") LIKE '%UPM%')
   OR (UPPER("nome") LIKE '%SUBCOMANDANTE%' AND UPPER("nome") LIKE '%UPM%')
   OR (
     UPPER("nome") LIKE '%CMT%'
     AND UPPER("nome") LIKE '%UPM%'
     AND UPPER("nome") NOT LIKE '%SUBCMT%'
     AND UPPER("nome") NOT LIKE '%SUBTCMT%'
     AND UPPER("nome") NOT LIKE '%SUBCOMANDANTE%'
   );
