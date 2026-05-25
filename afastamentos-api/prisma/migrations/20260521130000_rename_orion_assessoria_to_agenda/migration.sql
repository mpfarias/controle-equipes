-- Migração legada: renomeia objetos do antigo Órion Assessoria para Órion Agenda.
-- Idempotente: só executa se a tabela antiga existir.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'assessoria_agenda_compromisso'
  ) THEN
    ALTER TABLE "assessoria_agenda_compromisso" RENAME TO "orion_agenda_compromisso";
    ALTER INDEX IF EXISTS "assessoria_agenda_compromisso_dataInicio_idx"
      RENAME TO "orion_agenda_compromisso_dataInicio_idx";
    ALTER INDEX IF EXISTS "assessoria_agenda_compromisso_status_idx"
      RENAME TO "orion_agenda_compromisso_status_idx";
    ALTER INDEX IF EXISTS "assessoria_agenda_compromisso_criadoPorId_idx"
      RENAME TO "orion_agenda_compromisso_criadoPorId_idx";
    ALTER TABLE "orion_agenda_compromisso"
      RENAME CONSTRAINT "assessoria_agenda_compromisso_pkey"
      TO "orion_agenda_compromisso_pkey";
    ALTER TABLE "orion_agenda_compromisso"
      RENAME CONSTRAINT "assessoria_agenda_compromisso_criadoPorId_fkey"
      TO "orion_agenda_compromisso_criadoPorId_fkey";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssessoriaAgendaTipo') THEN
    ALTER TYPE "AssessoriaAgendaTipo" RENAME TO "OrionAgendaTipo";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssessoriaAgendaStatus') THEN
    ALTER TYPE "AssessoriaAgendaStatus" RENAME TO "OrionAgendaStatus";
  END IF;
END $$;
