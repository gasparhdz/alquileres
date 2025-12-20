-- AlterTable
ALTER TABLE "tipos_gasto_inicial_contrato" ADD COLUMN     "esPorcentaje" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "valor_default" DECIMAL(12,4);
