-- Tabela de sequência diária (data em YYYY-MM-DD, fuso America/Sao_Paulo)
CREATE TABLE "error_report_protocol_sequence" (
    "diaReferencia" VARCHAR(10) NOT NULL,
    "contador" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "error_report_protocol_sequence_pkey" PRIMARY KEY ("diaReferencia")
);

-- Coluna de protocolo (preenchida antes de NOT NULL)
ALTER TABLE "errorReport" ADD COLUMN "protocolo" VARCHAR(15);

-- Retroativo: mesmo algoritmo (ordem por id dentro de cada dia em São Paulo)
WITH base AS (
    SELECT
        id,
        TO_CHAR(("createdAt" AT TIME ZONE 'America/Sao_Paulo'), 'YYYY') AS y,
        TO_CHAR(("createdAt" AT TIME ZONE 'America/Sao_Paulo'), 'MM') AS m,
        TO_CHAR(("createdAt" AT TIME ZONE 'America/Sao_Paulo'), 'DD') AS d,
        CASE "categoria"::text
            WHEN 'ERRO_SISTEMA' THEN '01'
            WHEN 'DUVIDA' THEN '02'
            WHEN 'MELHORIA' THEN '03'
            ELSE '04'
        END AS catc,
        ROW_NUMBER() OVER (
            PARTITION BY TO_CHAR(("createdAt" AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD')
            ORDER BY id
        ) AS dia_seq
    FROM "errorReport"
),
coded AS (
    SELECT id,
        y || catc || m || d || LPAD(dia_seq::text, 5, '0') AS proto
    FROM base
)
UPDATE "errorReport" er
SET "protocolo" = coded.proto
FROM coded
WHERE er.id = coded.id;

-- Inicializar contadores para não colidir com chamados já existentes
INSERT INTO "error_report_protocol_sequence" ("diaReferencia", "contador")
SELECT dia_ref, MAX(dia_seq)
FROM (
    SELECT
        TO_CHAR(("createdAt" AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD') AS dia_ref,
        ROW_NUMBER() OVER (
            PARTITION BY TO_CHAR(("createdAt" AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD')
            ORDER BY id
        ) AS dia_seq
    FROM "errorReport"
) sub
GROUP BY dia_ref;

ALTER TABLE "errorReport" ALTER COLUMN "protocolo" SET NOT NULL;

CREATE UNIQUE INDEX "errorReport_protocolo_key" ON "errorReport"("protocolo");
