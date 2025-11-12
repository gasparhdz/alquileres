-- AlterTable: Add honorarios_propietario column and modify gastos_administrativos precision
-- AlterTable: Remove tope_ajuste column

-- Add honorarios_propietario column
ALTER TABLE "contratos" ADD COLUMN "honorarios_propietario" DECIMAL(5, 2);

-- Modify gastos_administrativos to DECIMAL(5, 2) for percentage values
ALTER TABLE "contratos" 
  ALTER COLUMN "gastos_administrativos" TYPE DECIMAL(5, 2) USING "gastos_administrativos"::DECIMAL(5, 2);

-- Remove tope_ajuste column
ALTER TABLE "contratos" DROP COLUMN IF EXISTS "tope_ajuste";

