-- CreateTable
CREATE TABLE "RestricaoMedica" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestricaoMedica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RestricaoMedica_nome_key" ON "RestricaoMedica"("nome");

-- Inserir registros iniciais
INSERT INTO "RestricaoMedica" ("nome", "createdAt", "updatedAt") VALUES
('Restrição médica', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('Porte de arma suspenso', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
