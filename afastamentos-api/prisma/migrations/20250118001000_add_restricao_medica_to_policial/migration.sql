-- AlterTable
ALTER TABLE "Policial" ADD COLUMN "restricaoMedicaId" INTEGER;

-- AddForeignKey
ALTER TABLE "Policial" ADD CONSTRAINT "Policial_restricaoMedicaId_fkey" FOREIGN KEY ("restricaoMedicaId") REFERENCES "RestricaoMedica"("id") ON DELETE SET NULL ON UPDATE CASCADE;
