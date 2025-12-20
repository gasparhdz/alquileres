-- AlterTable
ALTER TABLE "tipos_cargo" ADD COLUMN     "periodicidad_id" INTEGER;

-- AddForeignKey
ALTER TABLE "tipos_cargo" ADD CONSTRAINT "tipos_cargo_periodicidad_id_fkey" FOREIGN KEY ("periodicidad_id") REFERENCES "periodicidades_impuesto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
