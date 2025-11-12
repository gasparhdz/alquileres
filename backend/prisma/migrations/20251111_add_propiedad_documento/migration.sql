-- CreateTable
CREATE TABLE "propiedad_documento" (
    "id" TEXT NOT NULL,
    "unidad_id" TEXT NOT NULL,
    "tipo_documento_id" TEXT NOT NULL,
    "necesario" BOOLEAN NOT NULL DEFAULT false,
    "recibido" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "propiedad_documento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "propiedad_documento_unidad_id_tipo_documento_id_key" ON "propiedad_documento"("unidad_id", "tipo_documento_id");

-- AddForeignKey
ALTER TABLE "propiedad_documento" ADD CONSTRAINT "propiedad_documento_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

