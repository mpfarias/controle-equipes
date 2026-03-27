-- CreateTable
CREATE TABLE "EscalaGerada" (
    "id" SERIAL NOT NULL,
    "dataEscala" DATE NOT NULL,
    "tipoServico" TEXT NOT NULL,
    "resumoEquipes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,
    "createdByName" TEXT,

    CONSTRAINT "EscalaGerada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalaGeradaLinha" (
    "id" SERIAL NOT NULL,
    "escalaGeradaId" INTEGER NOT NULL,
    "lista" TEXT NOT NULL,
    "policialId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "equipe" TEXT,
    "horarioServico" TEXT NOT NULL,
    "funcaoNome" TEXT,
    "detalheAfastamento" TEXT,

    CONSTRAINT "EscalaGeradaLinha_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EscalaGeradaLinha" ADD CONSTRAINT "EscalaGeradaLinha_escalaGeradaId_fkey" FOREIGN KEY ("escalaGeradaId") REFERENCES "EscalaGerada"("id") ON DELETE CASCADE ON UPDATE CASCADE;
