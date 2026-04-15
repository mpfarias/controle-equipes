DO $$
BEGIN
  IF to_regclass('public."errorReport"') IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'errorReport' AND column_name = 'anexoDataUrl'
  ) THEN
    ALTER TABLE "errorReport" ADD COLUMN "anexoDataUrl" TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'errorReport' AND column_name = 'anexoNome'
  ) THEN
    ALTER TABLE "errorReport" ADD COLUMN "anexoNome" VARCHAR(255);
  END IF;
END $$;
