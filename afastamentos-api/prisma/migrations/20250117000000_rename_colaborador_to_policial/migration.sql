-- Renomear tabela Colaborador para Policial
ALTER TABLE "Colaborador" RENAME TO "Policial";

-- Renomear a coluna colaboradorId para policialId na tabela Afastamento
ALTER TABLE "Afastamento" RENAME COLUMN "colaboradorId" TO "policialId";

-- Renomear a constraint de foreign key (PostgreSQL mantém o nome baseado na coluna)
-- Primeiro, vamos verificar e renomear a constraint se existir
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Afastamento_colaboradorId_fkey'
  ) THEN
    ALTER TABLE "Afastamento" RENAME CONSTRAINT "Afastamento_colaboradorId_fkey" TO "Afastamento_policialId_fkey";
  END IF;
END $$;

-- Renomear índices únicos e outros índices relacionados
DO $$ 
BEGIN
  -- Renomear índice único da matrícula
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'Colaborador_matricula_key'
  ) THEN
    ALTER INDEX "Colaborador_matricula_key" RENAME TO "Policial_matricula_key";
  END IF;
  
  -- Renomear chave primária se necessário
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Colaborador_pkey'
  ) THEN
    ALTER TABLE "Policial" RENAME CONSTRAINT "Colaborador_pkey" TO "Policial_pkey";
  END IF;
END $$;
