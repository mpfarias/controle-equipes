-- Permite previsão só com exercício (ano) para cotas anteriores ao ano civil; mês é opcional até o gozo.
ALTER TABLE "FeriasPolicial" ADD COLUMN "semMesDefinido" BOOLEAN NOT NULL DEFAULT false;
