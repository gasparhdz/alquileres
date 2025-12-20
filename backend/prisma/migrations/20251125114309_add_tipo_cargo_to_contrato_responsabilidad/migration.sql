/*
  Warnings:

  - A unique constraint covering the columns `[contrato_id,tipo_cargo_id]` on the table `contrato_responsabilidades` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "contrato_responsabilidades" DROP CONSTRAINT "contrato_responsabilidades_tipo_impuesto_id_fkey";

-- AlterTable
ALTER TABLE "contrato_responsabilidades" ADD COLUMN     "tipo_cargo_id" INTEGER,
ALTER COLUMN "tipo_impuesto_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "contrato_responsabilidades_contrato_id_tipo_cargo_id_key" ON "contrato_responsabilidades"("contrato_id", "tipo_cargo_id");

-- AddForeignKey
ALTER TABLE "contrato_responsabilidades" ADD CONSTRAINT "contrato_responsabilidades_tipo_impuesto_id_fkey" FOREIGN KEY ("tipo_impuesto_id") REFERENCES "tipos_impuesto_propiedad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_responsabilidades" ADD CONSTRAINT "contrato_responsabilidades_tipo_cargo_id_fkey" FOREIGN KEY ("tipo_cargo_id") REFERENCES "tipos_cargo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
