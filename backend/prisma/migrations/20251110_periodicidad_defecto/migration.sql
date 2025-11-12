-- Add periodicidad_por_defecto field to parametros table
ALTER TABLE "parametros"
    ADD COLUMN "periodicidad_por_defecto" TEXT;

-- Note: periodicidad_por_defecto stores the ID of a parameter from the 'periodicidad' category
-- This allows each impuesto (tipo_cargo) to have a default periodicidad

