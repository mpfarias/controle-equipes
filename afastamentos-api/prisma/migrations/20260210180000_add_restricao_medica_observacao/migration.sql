-- Add observação da restrição no policial (restrição ativa)
ALTER TABLE "Policial"
ADD COLUMN "restricaoMedicaObservacao" TEXT;

-- Add observação no histórico (quando a restrição é removida)
ALTER TABLE "RestricaoMedicaHistorico"
ADD COLUMN "observacao" TEXT;

