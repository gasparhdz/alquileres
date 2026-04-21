-- CreateTable tipos_movimiento y medios_pago (cuenta corriente).
-- Estas tablas existen en el schema pero no estaban en migraciones previas.

-- CreateTable
CREATE TABLE "tipos_movimiento" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    "deleted_by_id" INTEGER,

    CONSTRAINT "tipos_movimiento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tipos_movimiento_codigo_key" ON "tipos_movimiento"("codigo");

-- CreateTable
CREATE TABLE "medios_pago" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    "deleted_by_id" INTEGER,

    CONSTRAINT "medios_pago_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "medios_pago_codigo_key" ON "medios_pago"("codigo");
