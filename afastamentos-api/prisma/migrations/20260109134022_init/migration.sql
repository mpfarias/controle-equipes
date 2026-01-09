-- CreateEnum
CREATE TYPE "AfastamentoStatus" AS ENUM ('ATIVO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "PolicialStatus" AS ENUM ('ATIVO', 'DESIGNADO', 'COMISSIONADO', 'PTTC', 'DESATIVADO');

-- CreateEnum
CREATE TYPE "UsuarioStatus" AS ENUM ('ATIVO', 'DESATIVADO');

-- CreateEnum
CREATE TYPE "Equipe" AS ENUM ('A', 'B', 'C', 'D', 'E');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "Colaborador" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "equipe" "Equipe" NOT NULL DEFAULT 'A',
    "status" "PolicialStatus" NOT NULL DEFAULT 'ATIVO',
    "createdById" INTEGER,
    "createdByName" TEXT,
    "updatedById" INTEGER,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Colaborador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Afastamento" (
    "id" SERIAL NOT NULL,
    "colaboradorId" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "descricao" TEXT,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3),
    "status" "AfastamentoStatus" NOT NULL DEFAULT 'ATIVO',
    "createdById" INTEGER,
    "createdByName" TEXT,
    "updatedById" INTEGER,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Afastamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perguntaSeguranca" TEXT,
    "respostaSegurancaHash" TEXT,
    "equipe" "Equipe" NOT NULL DEFAULT 'A',
    "status" "UsuarioStatus" NOT NULL DEFAULT 'ATIVO',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdById" INTEGER,
    "createdByName" TEXT,
    "updatedById" INTEGER,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" INTEGER,
    "action" "AuditAction" NOT NULL,
    "userId" INTEGER,
    "userName" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Colaborador_matricula_key" ON "Colaborador"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_matricula_key" ON "Usuario"("matricula");

-- AddForeignKey
ALTER TABLE "Afastamento" ADD CONSTRAINT "Afastamento_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "Colaborador"("id") ON DELETE CASCADE ON UPDATE CASCADE;
