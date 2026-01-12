-- CreateTable
CREATE TABLE "MotivoAfastamento" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MotivoAfastamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MotivoAfastamento_nome_key" ON "MotivoAfastamento"("nome");

-- AlterTable
ALTER TABLE "Afastamento" ADD COLUMN "motivoId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Afastamento" ADD CONSTRAINT "Afastamento_motivoId_fkey" FOREIGN KEY ("motivoId") REFERENCES "MotivoAfastamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Note: The migration script (fix-motivo-migration.js) was run manually to migrate existing data
-- before this migration was applied. The motivo column was already dropped.
