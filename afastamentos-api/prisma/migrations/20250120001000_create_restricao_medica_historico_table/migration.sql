-- CreateTable
CREATE TABLE "RestricaoMedicaHistorico" (
    "id" SERIAL NOT NULL,
    "policialId" INTEGER NOT NULL,
    "restricaoMedicaId" INTEGER NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "removidoPorId" INTEGER,
    "removidoPorNome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestricaoMedicaHistorico_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RestricaoMedicaHistorico" ADD CONSTRAINT "RestricaoMedicaHistorico_policialId_fkey" FOREIGN KEY ("policialId") REFERENCES "Policial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestricaoMedicaHistorico" ADD CONSTRAINT "RestricaoMedicaHistorico_restricaoMedicaId_fkey" FOREIGN KEY ("restricaoMedicaId") REFERENCES "RestricaoMedica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrar dados existentes do histórico antes de remover as colunas
INSERT INTO "RestricaoMedicaHistorico" ("policialId", "restricaoMedicaId", "dataInicio", "dataFim", "removidoPorId", "removidoPorNome", "createdAt")
SELECT 
    "id" as "policialId",
    "restricaoMedicaHistoricoId" as "restricaoMedicaId",
    "restricaoMedicaDataInicio" as "dataInicio",
    "restricaoMedicaDataFim" as "dataFim",
    "restricaoMedicaRemovidoPorId" as "removidoPorId",
    "restricaoMedicaRemovidoPorNome" as "removidoPorNome",
    COALESCE("restricaoMedicaDataFim", CURRENT_TIMESTAMP) as "createdAt"
FROM "Policial"
WHERE "restricaoMedicaHistoricoId" IS NOT NULL;

-- Remove colunas antigas do histórico (agora estão na tabela separada)
ALTER TABLE "Policial" DROP COLUMN IF EXISTS "restricaoMedicaHistoricoId";
ALTER TABLE "Policial" DROP COLUMN IF EXISTS "restricaoMedicaDataInicio";
ALTER TABLE "Policial" DROP COLUMN IF EXISTS "restricaoMedicaDataFim";
ALTER TABLE "Policial" DROP COLUMN IF EXISTS "restricaoMedicaRemovidoPorId";
ALTER TABLE "Policial" DROP COLUMN IF EXISTS "restricaoMedicaRemovidoPorNome";
