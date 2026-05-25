-- Catálogo de quadros (QOPM/QPPM) + vínculo em Policial

CREATE TYPE "QuadroGrupo" AS ENUM ('OFICIAL', 'PRACA');

CREATE TABLE "quadro" (
    "id" SERIAL NOT NULL,
    "sigla" VARCHAR(20) NOT NULL,
    "grupo" "QuadroGrupo" NOT NULL,
    "ordem" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quadro_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "quadro_sigla_key" ON "quadro"("sigla");
CREATE UNIQUE INDEX "quadro_grupo_ordem_key" ON "quadro"("grupo", "ordem");

ALTER TABLE "Policial" ADD COLUMN "quadroId" INTEGER;

ALTER TABLE "Policial" ADD CONSTRAINT "Policial_quadroId_fkey" FOREIGN KEY ("quadroId") REFERENCES "quadro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "quadro" ("sigla", "grupo", "ordem", "updatedAt") VALUES
('QOPM', 'OFICIAL', 1, CURRENT_TIMESTAMP),
('QOPMA', 'OFICIAL', 2, CURRENT_TIMESTAMP),
('QOPME', 'OFICIAL', 3, CURRENT_TIMESTAMP),
('QOPMM', 'OFICIAL', 4, CURRENT_TIMESTAMP),
('QPPMC', 'PRACA', 1, CURRENT_TIMESTAMP),
('QPPME', 'PRACA', 2, CURRENT_TIMESTAMP),
('QPPMM', 'PRACA', 3, CURRENT_TIMESTAMP);
