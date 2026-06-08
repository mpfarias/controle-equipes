-- CreateEnum
CREATE TYPE "PolicialCategoriaCnh" AS ENUM ('A', 'AB', 'B', 'C', 'D', 'E');

-- AlterTable
ALTER TABLE "Policial"
ADD COLUMN "complemento" VARCHAR(100),
ADD COLUMN "quantidadeDependentes" INTEGER,
ADD COLUMN "dependentesNomes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "doadorOrgaos" BOOLEAN,
ADD COLUMN "categoriaCnh" "PolicialCategoriaCnh",
ADD COLUMN "cnhNaoHabilitado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "nivelSuperiorEm" VARCHAR(255),
ADD COLUMN "cursosCivisMilitares" VARCHAR(500);
