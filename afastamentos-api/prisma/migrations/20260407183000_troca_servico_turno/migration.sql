-- Turno do serviço trocado (12×24): define até quando a equipe invertida permanece no cadastro.
CREATE TYPE "TrocaServicoTurno" AS ENUM ('DIURNO', 'NOTURNO');

ALTER TABLE "TrocaServico" ADD COLUMN "turnoServicoA" "TrocaServicoTurno" NOT NULL DEFAULT 'NOTURNO';
ALTER TABLE "TrocaServico" ADD COLUMN "turnoServicoB" "TrocaServicoTurno" NOT NULL DEFAULT 'NOTURNO';
