-- Alter enum (PostgreSQL): add value for non-team 24x72 work schedule
ALTER TYPE "FuncaoExpedienteHorarioPreset" ADD VALUE IF NOT EXISTS 'JORNADA_24X72';

-- Function belongs to a fixed team (A, B, C...)
ALTER TABLE "Funcao" ADD COLUMN "equipeReferencia" TEXT;
