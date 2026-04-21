-- CreateTable
CREATE TABLE "propiedad_seguros" (
    "id" SERIAL NOT NULL,
    "propiedad_id" INTEGER NOT NULL,
    "compania" VARCHAR(100) NOT NULL,
    "nro_poliza" VARCHAR(100) NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "monto_asegurado" DECIMAL(14,2),
    "costo_poliza" DECIMAL(14,2),
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "propiedad_seguros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "propiedad_seguros_propiedad_id_idx" ON "propiedad_seguros"("propiedad_id");

-- CreateIndex
CREATE INDEX "propiedad_seguros_activo_idx" ON "propiedad_seguros"("activo");

-- AddForeignKey
ALTER TABLE "propiedad_seguros" ADD CONSTRAINT "propiedad_seguros_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
