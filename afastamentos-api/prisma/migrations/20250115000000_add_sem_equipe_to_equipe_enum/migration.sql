-- AlterEnum (tolerante para shadow DB vazio)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Equipe') THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'Equipe' AND e.enumlabel = 'SEM_EQUIPE'
        ) THEN
            ALTER TYPE "Equipe" ADD VALUE 'SEM_EQUIPE';
        END IF;
    END IF;
END $$;
