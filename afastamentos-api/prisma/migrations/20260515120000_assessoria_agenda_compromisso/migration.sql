-- CreateEnum
CREATE TYPE "AssessoriaAgendaTipo" AS ENUM ('REUNIAO', 'PRAZO', 'AUDIENCIA', 'OUTRO');

-- CreateEnum
CREATE TYPE "AssessoriaAgendaStatus" AS ENUM ('AGENDADO', 'CONCLUIDO', 'CANCELADO');

-- CreateTable
CREATE TABLE "assessoria_agenda_compromisso" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR(300) NOT NULL,
    "descricao" TEXT,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3),
    "diaInteiro" BOOLEAN NOT NULL DEFAULT false,
    "local" VARCHAR(300),
    "tipo" "AssessoriaAgendaTipo" NOT NULL DEFAULT 'REUNIAO',
    "status" "AssessoriaAgendaStatus" NOT NULL DEFAULT 'AGENDADO',
    "criadoPorId" INTEGER NOT NULL,
    "criadoPorNome" VARCHAR(200) NOT NULL,
    "atualizadoPorId" INTEGER,
    "atualizadoPorNome" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessoria_agenda_compromisso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessoria_agenda_compromisso_dataInicio_idx" ON "assessoria_agenda_compromisso"("dataInicio");

-- CreateIndex
CREATE INDEX "assessoria_agenda_compromisso_status_idx" ON "assessoria_agenda_compromisso"("status");

-- CreateIndex
CREATE INDEX "assessoria_agenda_compromisso_criadoPorId_idx" ON "assessoria_agenda_compromisso"("criadoPorId");

-- AddForeignKey
ALTER TABLE "assessoria_agenda_compromisso" ADD CONSTRAINT "assessoria_agenda_compromisso_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
