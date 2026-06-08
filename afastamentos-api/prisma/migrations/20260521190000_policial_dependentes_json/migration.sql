-- AlterTable: dependentes estruturados (nome, condição, condição outros)
ALTER TABLE "Policial" ADD COLUMN "dependentes" JSONB NOT NULL DEFAULT '[]';

UPDATE "Policial" p
SET "dependentes" = sub.arr
FROM (
  SELECT
    pol.id,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'nome', NULLIF(trim(n.nome), ''),
          'condicao', NULL,
          'condicaoOutros', NULL
        )
        ORDER BY n.ord
      ),
      '[]'::jsonb
    ) AS arr
  FROM "Policial" pol
  CROSS JOIN LATERAL unnest(pol."dependentesNomes") WITH ORDINALITY AS n(nome, ord)
  GROUP BY pol.id
) sub
WHERE p.id = sub.id;

ALTER TABLE "Policial" DROP COLUMN "dependentesNomes";
