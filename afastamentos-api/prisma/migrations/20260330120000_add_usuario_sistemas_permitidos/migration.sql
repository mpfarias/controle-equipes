-- Perfis de sistemas integrados: quais sistemas o usuário pode acessar
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "sistemasPermitidos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
