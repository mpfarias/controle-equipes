DO $$
BEGIN
  IF to_regclass('public."Usuario"') IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Usuario' AND column_name = 'fotoUrl'
  ) THEN
    ALTER TABLE "Usuario" ADD COLUMN "fotoUrl" TEXT;
  END IF;
END $$;
