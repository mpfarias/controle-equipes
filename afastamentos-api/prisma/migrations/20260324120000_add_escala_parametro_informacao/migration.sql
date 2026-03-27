-- CreateTable
CREATE TABLE "EscalaParametro" (
    "id" SERIAL NOT NULL,
    "chave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" INTEGER,
    "updatedByName" TEXT,

    CONSTRAINT "EscalaParametro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalaInformacao" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER,
    "createdByName" TEXT,
    "updatedById" INTEGER,
    "updatedByName" TEXT,

    CONSTRAINT "EscalaInformacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EscalaParametro_chave_key" ON "EscalaParametro"("chave");
