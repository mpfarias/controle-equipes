CREATE TABLE IF NOT EXISTS "RestricaoAfastamento" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "motivosRestritos" INTEGER[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdById" INTEGER,
    "createdByName" TEXT,
    "updatedById" INTEGER,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestricaoAfastamento_pkey" PRIMARY KEY ("id")
);
