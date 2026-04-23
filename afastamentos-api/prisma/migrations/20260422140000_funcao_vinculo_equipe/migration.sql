-- Vínculo de equipe no cadastro de policial: configurável por função (legado por nome continua coberto no backfill).

CREATE TYPE "FuncaoVinculoEquipe" AS ENUM ('OBRIGATORIA', 'OPCIONAL', 'SEM_EQUIPE');

ALTER TABLE "Funcao" ADD COLUMN "vinculoEquipe" "FuncaoVinculoEquipe" NOT NULL DEFAULT 'OBRIGATORIA';

UPDATE "Funcao"
SET "vinculoEquipe" = 'SEM_EQUIPE'
WHERE UPPER("nome") LIKE '%EXPEDIENTE ADM%'
   OR UPPER("nome") LIKE '%CMT UPM%'
   OR UPPER("nome") LIKE '%SUBCMT UPM%';
