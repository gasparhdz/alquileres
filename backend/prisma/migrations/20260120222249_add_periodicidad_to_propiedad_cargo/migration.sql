-- AlterTable
ALTER TABLE "propiedad_cargos" ADD COLUMN     "periodicidad_id" INTEGER;

-- AddForeignKey
ALTER TABLE "propiedad_cargos" ADD CONSTRAINT "propiedad_cargos_periodicidad_id_fkey" FOREIGN KEY ("periodicidad_id") REFERENCES "periodicidades_impuesto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
