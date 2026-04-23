-- CreateEnum
CREATE TYPE "FuncaoExpedienteHorarioPreset" AS ENUM ('AUTO', 'ORGAO_DIAS_UTEIS', 'SEG_SEX_07_19', 'SEG_SEX_12X36_SEMANA_ALTERNADA');

-- CreateEnum
CREATE TYPE "PolicialExpediente12x36Fase" AS ENUM ('PAR', 'IMPAR');

-- AlterTable
ALTER TABLE "Funcao" ADD COLUMN "expedienteHorarioPreset" "FuncaoExpedienteHorarioPreset" NOT NULL DEFAULT 'AUTO';

-- AlterTable
ALTER TABLE "Policial" ADD COLUMN "expediente12x36Fase" "PolicialExpediente12x36Fase";
