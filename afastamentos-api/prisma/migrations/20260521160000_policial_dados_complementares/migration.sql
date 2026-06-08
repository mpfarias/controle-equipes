-- CreateEnum
CREATE TYPE "PolicialSexo" AS ENUM ('MASCULINO', 'FEMININO');

-- AlterTable
ALTER TABLE "Policial"
ADD COLUMN "sexo" "PolicialSexo",
ADD COLUMN "dataAdmissao" DATE,
ADD COLUMN "cep" VARCHAR(8),
ADD COLUMN "logradouro" VARCHAR(255),
ADD COLUMN "cidade" VARCHAR(120),
ADD COLUMN "estado" VARCHAR(2),
ADD COLUMN "enderecoSemCep" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "contatoEmergenciaNome" VARCHAR(200),
ADD COLUMN "contatoEmergenciaTelefone" VARCHAR(11);
