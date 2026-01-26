-- CreateTable
CREATE TABLE "UsuarioNivelFuncao" (
    "id" SERIAL NOT NULL,
    "nivelId" INTEGER NOT NULL,
    "funcaoId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsuarioNivelFuncao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioNivelFuncao_nivelId_funcaoId_key" ON "UsuarioNivelFuncao"("nivelId", "funcaoId");

-- AddForeignKey
ALTER TABLE "UsuarioNivelFuncao" ADD CONSTRAINT "UsuarioNivelFuncao_nivelId_fkey" FOREIGN KEY ("nivelId") REFERENCES "UsuarioNivel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioNivelFuncao" ADD CONSTRAINT "UsuarioNivelFuncao_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "Funcao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
