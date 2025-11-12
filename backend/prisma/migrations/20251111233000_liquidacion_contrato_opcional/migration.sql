-- AlterTable: Hacer contratoId opcional en liquidaciones
ALTER TABLE "liquidaciones" ALTER COLUMN "contrato_id" DROP NOT NULL;

-- DropIndex: Eliminar índice único basado en contratoId_periodo
DROP INDEX IF EXISTS "unique_liquidacion";

-- CreateIndex: Crear nuevo índice único basado en unidadId_periodo
CREATE UNIQUE INDEX "unique_liquidacion" ON "liquidaciones"("unidad_id", "periodo");

-- AlterTable: Hacer la relación opcional (ya que contratoId puede ser NULL)
-- Nota: La foreign key constraint ya permite NULL, así que no necesitamos cambiar nada más

