-- AlterTable: Agregar autoGenerada a liquidaciones
ALTER TABLE "liquidaciones" ADD COLUMN IF NOT EXISTS "auto_generada" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: Índice para periodo y estado en liquidaciones
CREATE INDEX IF NOT EXISTS "liquidaciones_periodo_estado_idx" ON "liquidaciones"("periodo", "estado");

-- AlterTable: Hacer importe nullable en liquidacion_items
ALTER TABLE "liquidacion_items" ALTER COLUMN "importe" DROP NOT NULL;

-- AlterTable: Agregar nuevos campos a liquidacion_items
ALTER TABLE "liquidacion_items" 
  ADD COLUMN IF NOT EXISTS "estado" TEXT NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS "importe_anterior" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "completado_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completado_by" TEXT;

-- CreateIndex: Índices para liquidacion_items
CREATE INDEX IF NOT EXISTS "liquidacion_items_estado_tipo_cargo_idx" ON "liquidacion_items"("estado", "tipo_cargo");
CREATE INDEX IF NOT EXISTS "liquidacion_items_cuenta_tributaria_id_estado_idx" ON "liquidacion_items"("cuenta_tributaria_id", "estado");

-- AlterTable: Agregar campos a cuentas_tributarias
ALTER TABLE "cuentas_tributarias" 
  ADD COLUMN IF NOT EXISTS "usuario_portal" TEXT,
  ADD COLUMN IF NOT EXISTS "activo" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex: Índice para activo en cuentas_tributarias
CREATE INDEX IF NOT EXISTS "cuentas_tributarias_activo_idx" ON "cuentas_tributarias"("activo");

