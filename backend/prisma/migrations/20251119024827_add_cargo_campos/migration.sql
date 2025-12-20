-- CreateTable
CREATE TABLE "tipos_cargo_campos" (
    "id" SERIAL NOT NULL,
    "tipo_cargo_id" INTEGER NOT NULL,
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

    CONSTRAINT "tipos_cargo_campos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propiedad_cargo_campos" (
    "id" SERIAL NOT NULL,
    "propiedad_cargo_id" INTEGER NOT NULL,
    "tipo_campo_id" INTEGER NOT NULL,
    "valor" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "propiedad_cargo_campos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipos_cargo_campos_tipo_cargo_id_codigo_key" ON "tipos_cargo_campos"("tipo_cargo_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "propiedad_cargo_campos_propiedad_cargo_id_tipo_campo_id_key" ON "propiedad_cargo_campos"("propiedad_cargo_id", "tipo_campo_id");

-- AddForeignKey
ALTER TABLE "tipos_cargo_campos" ADD CONSTRAINT "tipos_cargo_campos_tipo_cargo_id_fkey" FOREIGN KEY ("tipo_cargo_id") REFERENCES "tipos_cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedad_cargo_campos" ADD CONSTRAINT "propiedad_cargo_campos_propiedad_cargo_id_fkey" FOREIGN KEY ("propiedad_cargo_id") REFERENCES "propiedad_cargos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedad_cargo_campos" ADD CONSTRAINT "propiedad_cargo_campos_tipo_campo_id_fkey" FOREIGN KEY ("tipo_campo_id") REFERENCES "tipos_cargo_campos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
