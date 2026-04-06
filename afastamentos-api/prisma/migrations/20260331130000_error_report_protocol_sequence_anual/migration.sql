-- Sequência dos 5 últimos dígitos do protocolo: por ano civil (reinicia em 01/01), não por dia.

CREATE TABLE "error_report_protocol_sequence_new" (
    "anoReferencia" VARCHAR(4) NOT NULL,
    "contador" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "error_report_protocol_sequence_new_pkey" PRIMARY KEY ("anoReferencia")
);

-- Contador por ano a partir dos protocolos já existentes (posições 11–15 = sequência).
INSERT INTO "error_report_protocol_sequence_new" ("anoReferencia", "contador")
SELECT
    SUBSTRING("protocolo", 1, 4) AS y,
    MAX(CAST(SUBSTRING("protocolo", 11, 5) AS INTEGER))
FROM "errorReport"
WHERE LENGTH("protocolo") = 15 AND "protocolo" ~ '^[0-9]{15}$'
GROUP BY SUBSTRING("protocolo", 1, 4);

DROP TABLE "error_report_protocol_sequence";

ALTER TABLE "error_report_protocol_sequence_new" RENAME TO "error_report_protocol_sequence";
