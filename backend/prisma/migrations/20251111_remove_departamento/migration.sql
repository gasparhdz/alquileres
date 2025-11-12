-- Remove departamento column from unidades table if it exists
-- (This migration is only needed if the previous migration was already applied)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'unidades' 
        AND column_name = 'departamento'
    ) THEN
        ALTER TABLE "unidades" DROP COLUMN "departamento";
    END IF;
END $$;

