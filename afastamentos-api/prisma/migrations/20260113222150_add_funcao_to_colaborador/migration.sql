-- AlterTable
ALTER TABLE "Colaborador" ADD COLUMN IF NOT EXISTS "funcaoId" INTEGER;

-- AddForeignKey
ALTER TABLE "Colaborador" ADD CONSTRAINT IF NOT EXISTS "Colaborador_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "Funcao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
