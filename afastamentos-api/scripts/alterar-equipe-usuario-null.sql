-- Script para permitir NULL na coluna equipe da tabela Usuario
-- e atualizar registros com SEM_EQUIPE para NULL

-- 1. Remover a constraint NOT NULL da coluna equipe
ALTER TABLE "Usuario" ALTER COLUMN equipe DROP NOT NULL;

-- 2. Remover o valor padrão 'A' se existir
ALTER TABLE "Usuario" ALTER COLUMN equipe DROP DEFAULT;

-- 3. Atualizar registros com SEM_EQUIPE para NULL
UPDATE "Usuario" SET equipe = NULL WHERE equipe = 'SEM_EQUIPE';
