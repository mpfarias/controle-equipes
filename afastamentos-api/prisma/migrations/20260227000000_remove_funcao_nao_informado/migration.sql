-- Reatribuir policiais que têm a função "NÃO INFORMADO" para outra função (a de menor id que não seja NÃO INFORMADO)
-- e em seguida remover a função "NÃO INFORMADO".

DO $$
DECLARE
  id_nao_informado INT;
  id_outra_funcao INT;
BEGIN
  SELECT id INTO id_nao_informado FROM "Funcao" WHERE UPPER(TRIM(nome)) = 'NÃO INFORMADO' LIMIT 1;
  IF id_nao_informado IS NOT NULL THEN
    SELECT id INTO id_outra_funcao FROM "Funcao" WHERE id != id_nao_informado ORDER BY id ASC LIMIT 1;
    IF id_outra_funcao IS NOT NULL THEN
      UPDATE "Policial" SET "funcaoId" = id_outra_funcao WHERE "funcaoId" = id_nao_informado;
      DELETE FROM "Funcao" WHERE id = id_nao_informado;
    END IF;
  END IF;
END $$;
