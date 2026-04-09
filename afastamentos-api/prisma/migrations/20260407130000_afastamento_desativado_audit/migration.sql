-- Auditoria de desativação de afastamento (quem / quando)
ALTER TABLE "Afastamento" ADD COLUMN "desativadoPorId" INTEGER;
ALTER TABLE "Afastamento" ADD COLUMN "desativadoPorNome" TEXT;
ALTER TABLE "Afastamento" ADD COLUMN "desativadoEm" TIMESTAMP(3);

UPDATE "Afastamento"
SET
  "desativadoPorId" = "updatedById",
  "desativadoPorNome" = "updatedByName",
  "desativadoEm" = "updatedAt"
WHERE status = 'ENCERRADO'
  AND "desativadoEm" IS NULL;
