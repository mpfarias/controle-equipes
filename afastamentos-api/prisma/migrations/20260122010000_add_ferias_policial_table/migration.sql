CREATE TABLE "FeriasPolicial" (
    "id" SERIAL NOT NULL,
    "policialId" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "confirmada" BOOLEAN NOT NULL DEFAULT false,
    "reprogramada" BOOLEAN NOT NULL DEFAULT false,
    "dataInicioOriginal" TIMESTAMP(3),
    "dataFimOriginal" TIMESTAMP(3),
    "createdById" INTEGER,
    "createdByName" TEXT,
    "updatedById" INTEGER,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeriasPolicial_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeriasPolicial_policialId_ano_key" ON "FeriasPolicial"("policialId", "ano");

ALTER TABLE "FeriasPolicial" ADD CONSTRAINT "FeriasPolicial_policialId_fkey"
    FOREIGN KEY ("policialId") REFERENCES "Policial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "FeriasPolicial" (
    "policialId",
    "ano",
    "dataInicio",
    "dataFim",
    "confirmada",
    "reprogramada",
    "dataInicioOriginal",
    "dataFimOriginal",
    "createdById",
    "createdByName",
    "updatedById",
    "updatedByName",
    "createdAt",
    "updatedAt"
)
SELECT
    p."id" AS "policialId",
    p."anoPrevisaoFerias" AS "ano",
    make_date(p."anoPrevisaoFerias", p."mesPrevisaoFerias", 1) AS "dataInicio",
    (make_date(p."anoPrevisaoFerias", p."mesPrevisaoFerias", 1) + INTERVAL '1 month' - INTERVAL '1 day') AS "dataFim",
    p."feriasConfirmadas" AS "confirmada",
    p."feriasReprogramadas" AS "reprogramada",
    CASE
        WHEN p."anoPrevisaoFeriasOriginal" IS NOT NULL AND p."mesPrevisaoFeriasOriginal" IS NOT NULL
        THEN make_date(p."anoPrevisaoFeriasOriginal", p."mesPrevisaoFeriasOriginal", 1)
        ELSE NULL
    END AS "dataInicioOriginal",
    CASE
        WHEN p."anoPrevisaoFeriasOriginal" IS NOT NULL AND p."mesPrevisaoFeriasOriginal" IS NOT NULL
        THEN (make_date(p."anoPrevisaoFeriasOriginal", p."mesPrevisaoFeriasOriginal", 1) + INTERVAL '1 month' - INTERVAL '1 day')
        ELSE NULL
    END AS "dataFimOriginal",
    p."createdById",
    p."createdByName",
    p."updatedById",
    p."updatedByName",
    p."createdAt",
    p."updatedAt"
FROM "Policial" p
WHERE p."mesPrevisaoFerias" IS NOT NULL
  AND p."anoPrevisaoFerias" IS NOT NULL;

ALTER TABLE "Policial"
DROP COLUMN "mesPrevisaoFerias",
DROP COLUMN "anoPrevisaoFerias",
DROP COLUMN "mesPrevisaoFeriasOriginal",
DROP COLUMN "anoPrevisaoFeriasOriginal",
DROP COLUMN "feriasConfirmadas",
DROP COLUMN "feriasReprogramadas";
