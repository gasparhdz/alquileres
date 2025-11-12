-- Make propietario_id optional in unidades table
ALTER TABLE "unidades"
    ALTER COLUMN "propietario_id" DROP NOT NULL;

-- Drop the existing unique constraint
DROP INDEX IF EXISTS "unidades_propietario_id_direccion_localidad_key";

-- Recreate the unique constraint (PostgreSQL allows NULLs in unique constraints)
-- Multiple rows can have the same (direccion, localidad) if propietario_id is NULL
CREATE UNIQUE INDEX "unidades_propietario_id_direccion_localidad_key" 
    ON "unidades"("propietario_id", "direccion", "localidad");

-- Note: The foreign key constraint will still work because PostgreSQL
-- allows NULL values in foreign key columns (they are simply not validated)

