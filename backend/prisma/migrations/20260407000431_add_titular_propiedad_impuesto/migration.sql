-- CreateEnum
CREATE TYPE "TitularImpuestoServicio" AS ENUM ('PROPIETARIO', 'OTRO');

-- AlterTable
ALTER TABLE "cliente_rol" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "clientes" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "liquidaciones_propietario" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "medios_pago" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "movimientos_cuenta_inquilino" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "movimientos_cuenta_propietario" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "propiedad_impuestos" ADD COLUMN     "titular_modo" "TitularImpuestoServicio",
ADD COLUMN     "titular_otro_apellido" VARCHAR(120),
ADD COLUMN     "titular_otro_nombre" VARCHAR(120),
ADD COLUMN     "titular_propietario_id" INTEGER;

-- AlterTable
ALTER TABLE "propiedad_propietario" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "roles_cliente" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tipos_movimiento" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "propiedad_impuestos_titular_propietario_id_idx" ON "propiedad_impuestos"("titular_propietario_id");

-- AddForeignKey
ALTER TABLE "propiedad_impuestos" ADD CONSTRAINT "propiedad_impuestos_titular_propietario_id_fkey" FOREIGN KEY ("titular_propietario_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "unique_contrato_cargo_tipo_expensa" RENAME TO "contrato_responsabilidades_contrato_id_tipo_cargo_id_tipo_e_key";

-- RenameIndex
ALTER INDEX "movimientos_cuenta_propietario_contrato_id_tipo_movimiento_id_i" RENAME TO "movimientos_cuenta_propietario_contrato_id_tipo_movimiento__idx";
