-- AlterTable
ALTER TABLE "liquidacion_items" ADD COLUMN     "contrato_gasto_inicial_id" INTEGER;

-- AddForeignKey
ALTER TABLE "liquidacion_items" ADD CONSTRAINT "liquidacion_items_contrato_gasto_inicial_id_fkey" FOREIGN KEY ("contrato_gasto_inicial_id") REFERENCES "contrato_gastos_iniciales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
