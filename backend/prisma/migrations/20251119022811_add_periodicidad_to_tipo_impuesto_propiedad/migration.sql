-- AlterTable
ALTER TABLE "tipos_impuesto_propiedad" ADD COLUMN     "periodicidad_id" INTEGER;

-- AddForeignKey
ALTER TABLE "tipos_impuesto_propiedad" ADD CONSTRAINT "tipos_impuesto_propiedad_periodicidad_id_fkey" FOREIGN KEY ("periodicidad_id") REFERENCES "periodicidades_impuesto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
