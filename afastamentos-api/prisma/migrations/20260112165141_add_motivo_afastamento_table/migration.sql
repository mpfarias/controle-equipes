/*
  Warnings:

  - You are about to drop the column `motivo` on the `Afastamento` table. All the data in the column will be lost.
  - Added the required column `motivoId` to the `Afastamento` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Afastamento" DROP COLUMN "motivo",
ADD COLUMN     "motivoId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "MotivoAfastamento" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MotivoAfastamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MotivoAfastamento_nome_key" ON "MotivoAfastamento"("nome");

-- AddForeignKey
ALTER TABLE "Afastamento" ADD CONSTRAINT "Afastamento_motivoId_fkey" FOREIGN KEY ("motivoId") REFERENCES "MotivoAfastamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
