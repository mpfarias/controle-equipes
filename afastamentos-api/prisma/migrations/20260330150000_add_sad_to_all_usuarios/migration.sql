-- Todos os usuários cadastrados utilizam o sistema SAD; acrescenta SAD sem remover outros sistemas e sem duplicar.
UPDATE "Usuario"
SET "sistemasPermitidos" = "sistemasPermitidos" || ARRAY['SAD']::text[]
WHERE NOT ('SAD' = ANY ("sistemasPermitidos"));
