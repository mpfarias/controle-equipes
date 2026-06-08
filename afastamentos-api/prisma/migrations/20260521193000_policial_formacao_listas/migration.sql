-- Converte campos de formação acadêmica de texto único para listas JSON.

ALTER TABLE "Policial" ALTER COLUMN "nivelSuperiorEm" DROP DEFAULT;

ALTER TABLE "Policial"
  ALTER COLUMN "nivelSuperiorEm" TYPE JSONB
  USING (
    CASE
      WHEN "nivelSuperiorEm" IS NULL OR TRIM("nivelSuperiorEm"::text) = '' THEN '[]'::jsonb
      ELSE jsonb_build_array(TRIM("nivelSuperiorEm"::text))
    END
  );

ALTER TABLE "Policial" ALTER COLUMN "nivelSuperiorEm" SET DEFAULT '[]'::jsonb;
ALTER TABLE "Policial" ALTER COLUMN "nivelSuperiorEm" SET NOT NULL;

ALTER TABLE "Policial" ALTER COLUMN "cursosCivisMilitares" DROP DEFAULT;

ALTER TABLE "Policial"
  ALTER COLUMN "cursosCivisMilitares" TYPE JSONB
  USING (
    CASE
      WHEN "cursosCivisMilitares" IS NULL OR TRIM("cursosCivisMilitares"::text) = '' THEN '[]'::jsonb
      ELSE jsonb_build_array(TRIM("cursosCivisMilitares"::text))
    END
  );

ALTER TABLE "Policial" ALTER COLUMN "cursosCivisMilitares" SET DEFAULT '[]'::jsonb;
ALTER TABLE "Policial" ALTER COLUMN "cursosCivisMilitares" SET NOT NULL;
