-- AlterTable
ALTER TABLE "liquidacion_items" ADD COLUMN     "pagado_por_actor_id" INTEGER;

-- AddForeignKey
ALTER TABLE "liquidacion_items" ADD CONSTRAINT "liquidacion_items_pagado_por_actor_id_fkey" FOREIGN KEY ("pagado_por_actor_id") REFERENCES "actores_responsable_contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;
