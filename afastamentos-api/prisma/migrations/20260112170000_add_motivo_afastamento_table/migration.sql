-- Corretiva idempotente (mesma lógica que 20260112165141): deploy retentativo ou bases onde 65141 não rodou.
DO $$
DECLARE
  has_motivo_col boolean;
  has_motivo_id boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Afastamento'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'MotivoAfastamento'
  ) THEN
    CREATE TABLE "MotivoAfastamento" (
      "id" SERIAL NOT NULL,
      "nome" TEXT NOT NULL,
      "descricao" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "MotivoAfastamento_pkey" PRIMARY KEY ("id")
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'i' AND c.relname = 'MotivoAfastamento_nome_key'
  ) THEN
    CREATE UNIQUE INDEX "MotivoAfastamento_nome_key" ON "MotivoAfastamento"("nome");
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Afastamento' AND column_name = 'motivo'
  ) INTO has_motivo_col;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Afastamento' AND column_name = 'motivoId'
  ) INTO has_motivo_id;

  INSERT INTO "MotivoAfastamento" ("nome", "descricao", "createdAt", "updatedAt")
  VALUES ('(sem título)', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("nome") DO NOTHING;

  IF has_motivo_col THEN
    INSERT INTO "MotivoAfastamento" ("nome", "descricao", "createdAt", "updatedAt")
    SELECT DISTINCT TRIM(a."motivo"), NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM "Afastamento" a
    WHERE a."motivo" IS NOT NULL AND TRIM(a."motivo") <> ''
    ON CONFLICT ("nome") DO NOTHING;

    IF NOT has_motivo_id THEN
      ALTER TABLE "Afastamento" ADD COLUMN "motivoId" INTEGER;
    END IF;

    UPDATE "Afastamento" a
    SET "motivoId" = m."id"
    FROM "MotivoAfastamento" m
    WHERE a."motivo" IS NOT NULL AND TRIM(a."motivo") = m."nome" AND (a."motivoId" IS DISTINCT FROM m."id" OR a."motivoId" IS NULL);

    UPDATE "Afastamento"
    SET "motivoId" = (SELECT "id" FROM "MotivoAfastamento" WHERE "nome" = '(sem título)' LIMIT 1)
    WHERE "motivoId" IS NULL;

    ALTER TABLE "Afastamento" ALTER COLUMN "motivoId" SET NOT NULL;

    ALTER TABLE "Afastamento" DROP COLUMN "motivo";
  ELSIF has_motivo_id THEN
    UPDATE "Afastamento"
    SET "motivoId" = (SELECT "id" FROM "MotivoAfastamento" WHERE "nome" = '(sem título)' LIMIT 1)
    WHERE "motivoId" IS NULL;

    ALTER TABLE "Afastamento" ALTER COLUMN "motivoId" SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Afastamento' AND column_name = 'motivoId'
  ) AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Afastamento_motivoId_fkey') THEN
    ALTER TABLE "Afastamento" ADD CONSTRAINT "Afastamento_motivoId_fkey"
      FOREIGN KEY ("motivoId") REFERENCES "MotivoAfastamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
