-- Unificar Inquilino y Propietario en modelo Cliente con roles (RolCliente + ClienteRol).
-- Conservar nombres de FK: inquilino_id y propietario_id a nivel motor.

-- DropForeignKey: contratos -> inquilinos
ALTER TABLE "contratos" DROP CONSTRAINT IF EXISTS "contratos_inquilino_id_fkey";

-- DropTable: propiedad_propietario (referencia a propietarios)
DROP TABLE IF EXISTS "propiedad_propietario";

-- DropTable
DROP TABLE IF EXISTS "inquilinos";
DROP TABLE IF EXISTS "propietarios";

-- CreateTable roles_cliente
CREATE TABLE "roles_cliente" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "roles_cliente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roles_cliente_codigo_key" ON "roles_cliente"("codigo");

-- CreateTable clientes (misma estructura que inquilinos/propietarios)
CREATE TABLE "clientes" (
    "id" SERIAL NOT NULL,
    "apellido" TEXT,
    "nombre" TEXT,
    "razon_social" TEXT,
    "dni" TEXT,
    "cuit" TEXT,
    "mail" TEXT,
    "telefono" TEXT,
    "dir_calle" TEXT,
    "dir_nro" TEXT,
    "dir_piso" TEXT,
    "dir_depto" TEXT,
    "localidad_id" INTEGER,
    "provincia_id" INTEGER,
    "tipo_persona_id" INTEGER,
    "condicion_iva_id" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clientes_dni_key" ON "clientes"("dni");
CREATE UNIQUE INDEX "clientes_cuit_key" ON "clientes"("cuit");

-- CreateTable cliente_rol (pivot)
CREATE TABLE "cliente_rol" (
    "cliente_id" INTEGER NOT NULL,
    "rol_id" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "cliente_rol_pkey" PRIMARY KEY ("cliente_id","rol_id")
);

-- AddForeignKey clientes -> localidades, provincias, tipos_persona, condiciones_iva
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_localidad_id_fkey" FOREIGN KEY ("localidad_id") REFERENCES "localidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_provincia_id_fkey" FOREIGN KEY ("provincia_id") REFERENCES "provincias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_tipo_persona_id_fkey" FOREIGN KEY ("tipo_persona_id") REFERENCES "tipos_persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_condicion_iva_id_fkey" FOREIGN KEY ("condicion_iva_id") REFERENCES "condiciones_iva"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey contratos.inquilino_id -> clientes (conservar nombre columna inquilino_id)
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable propiedad_propietario de nuevo con propietario_id -> clientes
CREATE TABLE "propiedad_propietario" (
    "propiedad_id" INTEGER NOT NULL,
    "propietario_id" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "propiedad_propietario_pkey" PRIMARY KEY ("propiedad_id","propietario_id")
);

ALTER TABLE "propiedad_propietario" ADD CONSTRAINT "propiedad_propietario_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "propiedad_propietario" ADD CONSTRAINT "propiedad_propietario_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey cliente_rol
ALTER TABLE "cliente_rol" ADD CONSTRAINT "cliente_rol_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cliente_rol" ADD CONSTRAINT "cliente_rol_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles_cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
