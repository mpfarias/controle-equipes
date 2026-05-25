-- Postos/graduações de policial (catálogo) + vínculo em Policial

CREATE TABLE "posto_graduacao" (
    "id" SERIAL NOT NULL,
    "sigla" VARCHAR(40) NOT NULL,
    "ordem" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posto_graduacao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "posto_graduacao_sigla_key" ON "posto_graduacao"("sigla");
CREATE UNIQUE INDEX "posto_graduacao_ordem_key" ON "posto_graduacao"("ordem");

ALTER TABLE "Policial" ADD COLUMN "postoGraduacaoId" INTEGER;

ALTER TABLE "Policial" ADD CONSTRAINT "Policial_postoGraduacaoId_fkey" FOREIGN KEY ("postoGraduacaoId") REFERENCES "posto_graduacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "posto_graduacao" ("sigla", "ordem", "updatedAt") VALUES
('SD 2ª CL', 1, CURRENT_TIMESTAMP),
('SD', 2, CURRENT_TIMESTAMP),
('CB', 3, CURRENT_TIMESTAMP),
('3º SGT', 4, CURRENT_TIMESTAMP),
('2º SGT', 5, CURRENT_TIMESTAMP),
('1º SGT', 6, CURRENT_TIMESTAMP),
('ST', 7, CURRENT_TIMESTAMP),
('ASP', 8, CURRENT_TIMESTAMP),
('2º TEN', 9, CURRENT_TIMESTAMP),
('1º TEN', 10, CURRENT_TIMESTAMP),
('CAP', 11, CURRENT_TIMESTAMP),
('MAJ', 12, CURRENT_TIMESTAMP),
('TC', 13, CURRENT_TIMESTAMP),
('CEL', 14, CURRENT_TIMESTAMP);
