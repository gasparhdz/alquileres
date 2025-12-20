-- CreateTable
CREATE TABLE "tipos_impuesto_propiedad_campos" (
    "id" SERIAL NOT NULL,
    "tipo_impuesto_id" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "tipos_impuesto_propiedad_campos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propiedad_impuesto_campos" (
    "id" SERIAL NOT NULL,
    "propiedad_impuesto_id" INTEGER NOT NULL,
    "tipo_campo_id" INTEGER NOT NULL,
    "valor" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "propiedad_impuesto_campos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipos_impuesto_propiedad_campos_tipo_impuesto_id_codigo_key" ON "tipos_impuesto_propiedad_campos"("tipo_impuesto_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "propiedad_impuesto_campos_propiedad_impuesto_id_tipo_campo__key" ON "propiedad_impuesto_campos"("propiedad_impuesto_id", "tipo_campo_id");

-- AddForeignKey
ALTER TABLE "tipos_impuesto_propiedad_campos" ADD CONSTRAINT "tipos_impuesto_propiedad_campos_tipo_impuesto_id_fkey" FOREIGN KEY ("tipo_impuesto_id") REFERENCES "tipos_impuesto_propiedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedad_impuesto_campos" ADD CONSTRAINT "propiedad_impuesto_campos_propiedad_impuesto_id_fkey" FOREIGN KEY ("propiedad_impuesto_id") REFERENCES "propiedad_impuestos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedad_impuesto_campos" ADD CONSTRAINT "propiedad_impuesto_campos_tipo_campo_id_fkey" FOREIGN KEY ("tipo_campo_id") REFERENCES "tipos_impuesto_propiedad_campos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
