-- Add estado field if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contratos' AND column_name = 'estado'
    ) THEN
        ALTER TABLE "contratos" ADD COLUMN "estado" TEXT DEFAULT 'borrador';
    END IF;
END $$;

-- Add new fields for advanced estado management
ALTER TABLE "contratos" 
    ADD COLUMN IF NOT EXISTS "fecha_firma" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "rescision_at" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "motivo_rescision_id" TEXT,
    ADD COLUMN IF NOT EXISTS "prorroga_hasta" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "prorroga_de_id" TEXT,
    ADD COLUMN IF NOT EXISTS "renovado_por_id" TEXT,
    ADD COLUMN IF NOT EXISTS "renovacion_de_id" TEXT,
    ADD COLUMN IF NOT EXISTS "suspendido_desde" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "suspendido_hasta" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "motivo_suspension_id" TEXT,
    ADD COLUMN IF NOT EXISTS "en_mora" BOOLEAN NOT NULL DEFAULT false;

-- Add foreign key constraints for self-referencing relations
DO $$ 
BEGIN
    -- Add prorroga_de_id foreign key if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'contratos_prorroga_de_id_fkey'
    ) THEN
        ALTER TABLE "contratos" 
            ADD CONSTRAINT "contratos_prorroga_de_id_fkey" 
            FOREIGN KEY ("prorroga_de_id") REFERENCES "contratos"("id") 
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    -- Add renovado_por_id foreign key if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'contratos_renovado_por_id_fkey'
    ) THEN
        ALTER TABLE "contratos" 
            ADD CONSTRAINT "contratos_renovado_por_id_fkey" 
            FOREIGN KEY ("renovado_por_id") REFERENCES "contratos"("id") 
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    -- Add renovacion_de_id foreign key if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'contratos_renovacion_de_id_fkey'
    ) THEN
        ALTER TABLE "contratos" 
            ADD CONSTRAINT "contratos_renovacion_de_id_fkey" 
            FOREIGN KEY ("renovacion_de_id") REFERENCES "contratos"("id") 
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
