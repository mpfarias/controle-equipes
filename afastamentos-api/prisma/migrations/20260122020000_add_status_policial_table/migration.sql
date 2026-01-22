CREATE TABLE "StatusPolicial" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusPolicial_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StatusPolicial_nome_key" ON "StatusPolicial"("nome");

INSERT INTO "StatusPolicial" ("nome", "descricao")
VALUES
    ('ATIVO', 'Policial ativo'),
    ('DESIGNADO', 'Policial designado'),
    ('COMISSIONADO', 'Policial comissionado'),
    ('PTTC', 'Policial PTTC'),
    ('DESATIVADO', 'Policial desativado');

ALTER TABLE "Policial" ADD COLUMN "statusId" INTEGER;

UPDATE "Policial"
SET "statusId" = (
    SELECT "id"
    FROM "StatusPolicial"
    WHERE "StatusPolicial"."nome" = "Policial"."status"::text
);

ALTER TABLE "Policial" ALTER COLUMN "statusId" SET NOT NULL;

ALTER TABLE "Policial" ADD CONSTRAINT "Policial_statusId_fkey"
    FOREIGN KEY ("statusId") REFERENCES "StatusPolicial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Policial" DROP COLUMN "status";

DROP TYPE "PolicialStatus";
