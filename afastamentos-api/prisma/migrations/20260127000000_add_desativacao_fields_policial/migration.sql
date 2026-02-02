-- AlterTable
ALTER TABLE "Policial" ADD COLUMN "dataDesativacaoAPartirDe" TIMESTAMP(3),
ADD COLUMN "observacoesDesativacao" TEXT,
ADD COLUMN "desativadoPorId" INTEGER,
ADD COLUMN "desativadoPorNome" TEXT,
ADD COLUMN "desativadoEm" TIMESTAMP(3);
