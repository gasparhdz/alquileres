-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_rol" (
    "usuario_id" TEXT NOT NULL,
    "rol_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_rol_pkey" PRIMARY KEY ("usuario_id","rol_id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametros" (
    "id" TEXT NOT NULL,
    "categoria_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "abreviatura" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parametros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquilinos" (
    "id" TEXT NOT NULL,
    "apellido" TEXT,
    "nombre" TEXT,
    "razon_social" TEXT,
    "dni" TEXT,
    "cuit" TEXT,
    "mail" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "localidad" TEXT,
    "condicion_iva" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "inquilinos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propietarios" (
    "id" TEXT NOT NULL,
    "apellido" TEXT,
    "nombre" TEXT,
    "razon_social" TEXT,
    "dni" TEXT,
    "cuit" TEXT,
    "mail" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "localidad" TEXT,
    "condicion_iva" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "propietarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades" (
    "id" TEXT NOT NULL,
    "propietario_id" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "localidad" TEXT NOT NULL,
    "tipo" TEXT,
    "estado" TEXT,
    "codigo_interno" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "unidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_tributarias" (
    "id" TEXT NOT NULL,
    "unidad_id" TEXT NOT NULL,
    "tipo_impuesto" TEXT NOT NULL,
    "codigo_1" TEXT,
    "codigo_2" TEXT,
    "periodicidad" TEXT,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cuentas_tributarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos" (
    "id" TEXT NOT NULL,
    "unidad_id" TEXT NOT NULL,
    "inquilino_id" TEXT NOT NULL,
    "nro_contrato" TEXT,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3),
    "duracion_meses" INTEGER,
    "monto_inicial" DECIMAL(10,2) NOT NULL,
    "gastos_administrativos" DECIMAL(10,2),
    "metodo_ajuste" TEXT,
    "frecuencia_ajuste_meses" INTEGER,
    "tope_ajuste" DECIMAL(5,2),
    "registrado_afip" BOOLEAN NOT NULL DEFAULT false,
    "moneda" TEXT DEFAULT 'ARS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_responsabilidades" (
    "id" TEXT NOT NULL,
    "contrato_id" TEXT NOT NULL,
    "tipo_cargo" TEXT NOT NULL,
    "quien_paga" TEXT NOT NULL,
    "titular" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contrato_responsabilidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garantias" (
    "id" TEXT NOT NULL,
    "contrato_id" TEXT NOT NULL,
    "tipo_garantia" TEXT,
    "estado_garantia" TEXT,
    "apellido" TEXT,
    "nombre" TEXT,
    "dni" TEXT,
    "cuit" TEXT,
    "telefono" TEXT,
    "mail" TEXT,
    "direccion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "garantias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_gastos_iniciales" (
    "id" TEXT NOT NULL,
    "contrato_id" TEXT NOT NULL,
    "tipo_gasto_inicial" TEXT NOT NULL,
    "importe" DECIMAL(10,2) NOT NULL,
    "estado" TEXT,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contrato_gastos_iniciales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidaciones" (
    "id" TEXT NOT NULL,
    "contrato_id" TEXT NOT NULL,
    "unidad_id" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "vencimiento" TIMESTAMP(3),
    "total" DECIMAL(10,2) NOT NULL,
    "numeracion" TEXT,
    "observaciones" TEXT,
    "emision_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "liquidaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidacion_items" (
    "id" TEXT NOT NULL,
    "liquidacion_id" TEXT NOT NULL,
    "tipo_cargo" TEXT NOT NULL,
    "cuenta_tributaria_id" TEXT,
    "periodo_ref" TEXT,
    "importe" DECIMAL(10,2) NOT NULL,
    "quien_paga" TEXT NOT NULL,
    "fuente" TEXT,
    "ref_externa" TEXT,
    "observaciones" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "liquidacion_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_codigo_key" ON "categorias"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "parametros_categoria_id_codigo_key" ON "parametros"("categoria_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "inquilinos_dni_nombre_key" ON "inquilinos"("dni", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "inquilinos_cuit_key" ON "inquilinos"("cuit");

-- CreateIndex
CREATE UNIQUE INDEX "propietarios_dni_nombre_key" ON "propietarios"("dni", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "propietarios_cuit_key" ON "propietarios"("cuit");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_propietario_id_direccion_localidad_key" ON "unidades"("propietario_id", "direccion", "localidad");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_tributarias_unidad_id_tipo_impuesto_key" ON "cuentas_tributarias"("unidad_id", "tipo_impuesto");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_unidad_id_inquilino_id_fecha_inicio_key" ON "contratos"("unidad_id", "inquilino_id", "fecha_inicio");

-- CreateIndex
CREATE UNIQUE INDEX "liquidaciones_contrato_id_periodo_key" ON "liquidaciones"("contrato_id", "periodo");

-- AddForeignKey
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametros" ADD CONSTRAINT "parametros_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_tributarias" ADD CONSTRAINT "cuentas_tributarias_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_responsabilidades" ADD CONSTRAINT "contrato_responsabilidades_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garantias" ADD CONSTRAINT "garantias_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_gastos_iniciales" ADD CONSTRAINT "contrato_gastos_iniciales_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_items" ADD CONSTRAINT "liquidacion_items_liquidacion_id_fkey" FOREIGN KEY ("liquidacion_id") REFERENCES "liquidaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_items" ADD CONSTRAINT "liquidacion_items_cuenta_tributaria_id_fkey" FOREIGN KEY ("cuenta_tributaria_id") REFERENCES "cuentas_tributarias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
