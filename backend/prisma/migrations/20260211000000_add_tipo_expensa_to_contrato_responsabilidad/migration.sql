-- AlterTable (idempotente)
ALTER TABLE "contrato_responsabilidades" ADD COLUMN IF NOT EXISTS "tipo_expensa_id" INTEGER;

-- DropIndex: era un UNIQUE INDEX, no CONSTRAINT (generado por Prisma en migración anterior)
DROP INDEX IF EXISTS "contrato_responsabilidades_contrato_id_tipo_cargo_id_key";

-- CreateIndex (idempotente)
CREATE UNIQUE INDEX IF NOT EXISTS "unique_contrato_cargo_tipo_expensa" ON "contrato_responsabilidades"("contrato_id", "tipo_cargo_id", "tipo_expensa_id");

-- AddForeignKey (solo si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contrato_responsabilidades_tipo_expensa_id_fkey'
  ) THEN
    ALTER TABLE "contrato_responsabilidades"
    ADD CONSTRAINT "contrato_responsabilidades_tipo_expensa_id_fkey"
    FOREIGN KEY ("tipo_expensa_id") REFERENCES "tipos_expensa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
