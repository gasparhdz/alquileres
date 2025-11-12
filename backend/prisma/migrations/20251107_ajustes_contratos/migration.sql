-- Create enum for ajuste origen
CREATE TYPE "AjusteOrigen" AS ENUM ('manual', 'automatico');

-- Add new columns to contratos
ALTER TABLE "contratos"
    ADD COLUMN "monto_actual" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN "ultimo_ajuste_at" TIMESTAMP,
    ADD COLUMN "indice_aumento" TEXT,
    ADD COLUMN "periodo_aumento" INTEGER;

-- Inicializar monto_actual con el monto_inicial existente
UPDATE "contratos"
SET "monto_actual" = "monto_inicial"
WHERE "monto_actual" = 0;

-- Remover default por compatibilidad con Prisma
ALTER TABLE "contratos"
    ALTER COLUMN "monto_actual" DROP DEFAULT;

-- Crear tabla indice_ajuste
CREATE TABLE "indice_ajuste" (
    "id" SERIAL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "valor" DECIMAL(12, 6) NOT NULL,
    "variacion" DECIMAL(10, 6),
    "fuente" TEXT,
    "fecha_publicacion" TIMESTAMP NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "indice_ajuste_codigo_periodo_key"
    ON "indice_ajuste" ("codigo", "periodo");

-- Crear tabla contrato_ajuste
CREATE TABLE "contrato_ajuste" (
    "id" SERIAL PRIMARY KEY,
    "contrato_id" TEXT NOT NULL,
    "fecha_ajuste" TIMESTAMP NOT NULL,
    "indice_usado" TEXT NOT NULL,
    "valor_indice" DECIMAL(12, 6) NOT NULL,
    "monto_anterior" DECIMAL(10, 2) NOT NULL,
    "monto_nuevo" DECIMAL(10, 2) NOT NULL,
    "porcentaje_aumento" DECIMAL(10, 4) NOT NULL,
    "origen" "AjusteOrigen" NOT NULL,
    "observaciones" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "contrato_ajuste_contrato_id_fkey"
        FOREIGN KEY ("contrato_id")
        REFERENCES "contratos" ("id")
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


