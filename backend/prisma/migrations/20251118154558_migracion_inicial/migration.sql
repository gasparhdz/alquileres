-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "apellido" TEXT,
    "nombre" TEXT,
    "nombre_usuario" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "password_hash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_rol" (
    "usuario_id" INTEGER NOT NULL,
    "rol_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,

    CONSTRAINT "usuario_rol_pkey" PRIMARY KEY ("usuario_id","rol_id")
);

-- CreateTable
CREATE TABLE "permisos" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    "deleted_by_id" INTEGER,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol_permiso" (
    "rol_id" INTEGER NOT NULL,
    "permiso_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,

    CONSTRAINT "rol_permiso_pkey" PRIMARY KEY ("rol_id","permiso_id")
);

-- CreateTable
CREATE TABLE "tipos_persona" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    "deleted_by_id" INTEGER,

    CONSTRAINT "tipos_persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provincias" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    "deleted_by_id" INTEGER,

    CONSTRAINT "provincias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "localidades" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "provincia_id" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    "deleted_by_id" INTEGER,

    CONSTRAINT "localidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "condiciones_iva" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    "deleted_by_id" INTEGER,

    CONSTRAINT "condiciones_iva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambientes_propiedad" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    "deleted_by_id" INTEGER,

    CONSTRAINT "ambientes_propiedad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_propiedad" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    "deleted_by_id" INTEGER,

    CONSTRAINT "tipos_propiedad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estados_propiedad" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    "deleted_by_id" INTEGER,

    CONSTRAINT "estados_propiedad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destinos_propiedad" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    "deleted_by_id" INTEGER,

    CONSTRAINT "destinos_propiedad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_impuesto_propiedad" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    "deleted_by_id" INTEGER,

    CONSTRAINT "tipos_impuesto_propiedad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_cargo" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "tipos_cargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_expensa" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "tipos_expensa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodicidades_impuesto" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    "deleted_by_id" INTEGER,

    CONSTRAINT "periodicidades_impuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_documento_propiedad" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "tipos_documento_propiedad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monedas" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "simbolo" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "monedas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estados_contrato" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "esFinal" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "estados_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metodos_ajuste_contrato" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "metodos_ajuste_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indice_ajuste" (
    "id" SERIAL NOT NULL,
    "metodo_ajuste_id" INTEGER NOT NULL,
    "periodo" TEXT NOT NULL,
    "valor" DECIMAL(12,6) NOT NULL,
    "variacion" DECIMAL(10,6),
    "fuente" TEXT,
    "fecha_publicacion" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "indice_ajuste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actores_responsable_contrato" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "actores_responsable_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_garantia_contrato" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "tipos_garantia_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estados_garantia_contrato" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "deletedById" INTEGER,

    CONSTRAINT "estados_garantia_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_gasto_inicial_contrato" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "deletedById" INTEGER,

    CONSTRAINT "tipos_gasto_inicial_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estados_liquidacion" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "esFinal" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "estados_liquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estados_item_liquidacion" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "estados_item_liquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquilinos" (
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
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "inquilinos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propietarios" (
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
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "propietarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propiedades" (
    "id" SERIAL NOT NULL,
    "dir_calle" TEXT NOT NULL,
    "dir_nro" TEXT NOT NULL,
    "dir_piso" TEXT,
    "dir_depto" TEXT,
    "localidad_id" INTEGER,
    "provincia_id" INTEGER,
    "codigo_interno" TEXT,
    "descripcion" TEXT,
    "tipo_propiedad_id" INTEGER,
    "estado_propiedad_id" INTEGER,
    "destino_id" INTEGER,
    "ambientes_id" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "propiedades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propiedad_propietario" (
    "propiedad_id" INTEGER NOT NULL,
    "propietario_id" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "propiedad_propietario_pkey" PRIMARY KEY ("propiedad_id","propietario_id")
);

-- CreateTable
CREATE TABLE "propiedad_impuestos" (
    "id" SERIAL NOT NULL,
    "propiedad_id" INTEGER NOT NULL,
    "tipo_impuesto_id" INTEGER NOT NULL,
    "periodicidad_id" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "propiedad_impuestos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propiedad_cargos" (
    "id" SERIAL NOT NULL,
    "propiedad_id" INTEGER NOT NULL,
    "tipo_cargo_id" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "propiedad_cargos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propiedad_documento" (
    "id" SERIAL NOT NULL,
    "propiedad_id" INTEGER NOT NULL,
    "tipo_documento_id" INTEGER NOT NULL,
    "necesario" BOOLEAN NOT NULL DEFAULT false,
    "recibido" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "propiedad_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos" (
    "id" SERIAL NOT NULL,
    "propiedad_id" INTEGER NOT NULL,
    "inquilino_id" INTEGER NOT NULL,
    "nro_contrato" TEXT,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3),
    "duracion_meses" INTEGER,
    "monto_inicial" DECIMAL(12,2) NOT NULL,
    "monto_actual" DECIMAL(12,2) NOT NULL,
    "moneda_id" INTEGER,
    "metodo_ajuste_id" INTEGER,
    "frecuencia_ajuste_meses" INTEGER,
    "gastos_administrativos" DECIMAL(5,2),
    "honorarios_propietario" DECIMAL(5,2),
    "estado_contrato_id" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_responsabilidades" (
    "id" SERIAL NOT NULL,
    "contrato_id" INTEGER NOT NULL,
    "tipo_impuesto_id" INTEGER NOT NULL,
    "quien_paga_proveedor_id" INTEGER NOT NULL,
    "quien_soporta_costo_id" INTEGER NOT NULL,
    "titular" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "contrato_responsabilidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_garantias" (
    "id" SERIAL NOT NULL,
    "contrato_id" INTEGER NOT NULL,
    "tipo_garantia_id" INTEGER,
    "estado_garantia_id" INTEGER,
    "apellido" TEXT,
    "nombre" TEXT,
    "dni" TEXT,
    "cuit" TEXT,
    "telefono" TEXT,
    "mail" TEXT,
    "direccion" TEXT,
    "costo_averiguacion" DECIMAL(12,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "contrato_garantias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_gastos_iniciales" (
    "id" SERIAL NOT NULL,
    "contrato_id" INTEGER NOT NULL,
    "tipo_gasto_inicial_id" INTEGER NOT NULL,
    "valor_calculo" DECIMAL(12,4),
    "importe" DECIMAL(12,2) NOT NULL,
    "quien_paga_id" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "contrato_gastos_iniciales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_ajuste" (
    "id" SERIAL NOT NULL,
    "contrato_id" INTEGER NOT NULL,
    "fecha_ajuste" TIMESTAMP(3) NOT NULL,
    "monto_anterior" DECIMAL(12,2) NOT NULL,
    "monto_nuevo" DECIMAL(12,2) NOT NULL,
    "porcentaje_aumento" DECIMAL(10,4) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "contrato_ajuste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidaciones" (
    "id" SERIAL NOT NULL,
    "propiedad_id" INTEGER NOT NULL,
    "contrato_id" INTEGER,
    "periodo" TEXT NOT NULL,
    "estado_liquidacion_id" INTEGER NOT NULL,
    "vencimiento" TIMESTAMP(3),
    "total" DECIMAL(12,2) NOT NULL,
    "numeracion" TEXT,
    "observaciones" TEXT,
    "emision_at" TIMESTAMP(3),
    "auto_generada" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "liquidaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidacion_items" (
    "id" SERIAL NOT NULL,
    "liquidacion_id" INTEGER NOT NULL,
    "propiedad_impuesto_id" INTEGER,
    "tipo_cargo_id" INTEGER,
    "tipo_expensa_id" INTEGER,
    "periodo_ref" TEXT,
    "importe" DECIMAL(12,2),
    "estado_item_id" INTEGER NOT NULL,
    "actor_facturado_id" INTEGER,
    "quien_soporta_costo_id" INTEGER,
    "visible_en_boleta_inq" BOOLEAN NOT NULL DEFAULT true,
    "afecta_saldo_inq" BOOLEAN NOT NULL DEFAULT true,
    "ref_externa" TEXT,
    "observaciones" TEXT,
    "importe_anterior" DECIMAL(12,2),
    "completado_at" TIMESTAMP(3),
    "completado_by_id" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "liquidacion_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_nombre_usuario_key" ON "usuarios"("nombre_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_codigo_key" ON "roles"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_codigo_key" ON "permisos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_persona_codigo_key" ON "tipos_persona"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "provincias_codigo_key" ON "provincias"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "condiciones_iva_codigo_key" ON "condiciones_iva"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ambientes_propiedad_codigo_key" ON "ambientes_propiedad"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_propiedad_codigo_key" ON "tipos_propiedad"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "estados_propiedad_codigo_key" ON "estados_propiedad"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "destinos_propiedad_codigo_key" ON "destinos_propiedad"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_impuesto_propiedad_codigo_key" ON "tipos_impuesto_propiedad"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_cargo_codigo_key" ON "tipos_cargo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_expensa_codigo_key" ON "tipos_expensa"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "periodicidades_impuesto_codigo_key" ON "periodicidades_impuesto"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_documento_propiedad_codigo_key" ON "tipos_documento_propiedad"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "monedas_codigo_key" ON "monedas"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "estados_contrato_codigo_key" ON "estados_contrato"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "metodos_ajuste_contrato_codigo_key" ON "metodos_ajuste_contrato"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "indice_ajuste_metodo_ajuste_id_periodo_key" ON "indice_ajuste"("metodo_ajuste_id", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "actores_responsable_contrato_codigo_key" ON "actores_responsable_contrato"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_garantia_contrato_codigo_key" ON "tipos_garantia_contrato"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "estados_garantia_contrato_codigo_key" ON "estados_garantia_contrato"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_gasto_inicial_contrato_codigo_key" ON "tipos_gasto_inicial_contrato"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "estados_liquidacion_codigo_key" ON "estados_liquidacion"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "estados_item_liquidacion_codigo_key" ON "estados_item_liquidacion"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "inquilinos_dni_key" ON "inquilinos"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "inquilinos_cuit_key" ON "inquilinos"("cuit");

-- CreateIndex
CREATE UNIQUE INDEX "propietarios_dni_key" ON "propietarios"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "propietarios_cuit_key" ON "propietarios"("cuit");

-- CreateIndex
CREATE UNIQUE INDEX "propiedades_dir_calle_dir_nro_dir_piso_dir_depto_localidad__key" ON "propiedades"("dir_calle", "dir_nro", "dir_piso", "dir_depto", "localidad_id");

-- CreateIndex
CREATE INDEX "propiedad_impuestos_activo_idx" ON "propiedad_impuestos"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "propiedad_cargos_propiedad_id_tipo_cargo_id_key" ON "propiedad_cargos"("propiedad_id", "tipo_cargo_id");

-- CreateIndex
CREATE UNIQUE INDEX "propiedad_documento_propiedad_id_tipo_documento_id_key" ON "propiedad_documento"("propiedad_id", "tipo_documento_id");

-- CreateIndex
CREATE INDEX "contratos_propiedad_id_idx" ON "contratos"("propiedad_id");

-- CreateIndex
CREATE INDEX "contratos_inquilino_id_idx" ON "contratos"("inquilino_id");

-- CreateIndex
CREATE INDEX "contratos_estado_contrato_id_idx" ON "contratos"("estado_contrato_id");

-- CreateIndex
CREATE UNIQUE INDEX "contrato_responsabilidades_contrato_id_tipo_impuesto_id_key" ON "contrato_responsabilidades"("contrato_id", "tipo_impuesto_id");

-- CreateIndex
CREATE INDEX "contrato_ajuste_contrato_id_fecha_ajuste_idx" ON "contrato_ajuste"("contrato_id", "fecha_ajuste");

-- CreateIndex
CREATE INDEX "liquidaciones_periodo_estado_liquidacion_id_idx" ON "liquidaciones"("periodo", "estado_liquidacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "liquidaciones_propiedad_id_periodo_key" ON "liquidaciones"("propiedad_id", "periodo");

-- CreateIndex
CREATE INDEX "liquidacion_items_estado_item_id_idx" ON "liquidacion_items"("estado_item_id");

-- CreateIndex
CREATE INDEX "liquidacion_items_propiedad_impuesto_id_estado_item_id_idx" ON "liquidacion_items"("propiedad_impuesto_id", "estado_item_id");

-- AddForeignKey
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permisos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "localidades" ADD CONSTRAINT "localidades_provincia_id_fkey" FOREIGN KEY ("provincia_id") REFERENCES "provincias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indice_ajuste" ADD CONSTRAINT "indice_ajuste_metodo_ajuste_id_fkey" FOREIGN KEY ("metodo_ajuste_id") REFERENCES "metodos_ajuste_contrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquilinos" ADD CONSTRAINT "inquilinos_localidad_id_fkey" FOREIGN KEY ("localidad_id") REFERENCES "localidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquilinos" ADD CONSTRAINT "inquilinos_provincia_id_fkey" FOREIGN KEY ("provincia_id") REFERENCES "provincias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquilinos" ADD CONSTRAINT "inquilinos_tipo_persona_id_fkey" FOREIGN KEY ("tipo_persona_id") REFERENCES "tipos_persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquilinos" ADD CONSTRAINT "inquilinos_condicion_iva_id_fkey" FOREIGN KEY ("condicion_iva_id") REFERENCES "condiciones_iva"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propietarios" ADD CONSTRAINT "propietarios_localidad_id_fkey" FOREIGN KEY ("localidad_id") REFERENCES "localidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propietarios" ADD CONSTRAINT "propietarios_provincia_id_fkey" FOREIGN KEY ("provincia_id") REFERENCES "provincias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propietarios" ADD CONSTRAINT "propietarios_tipo_persona_id_fkey" FOREIGN KEY ("tipo_persona_id") REFERENCES "tipos_persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propietarios" ADD CONSTRAINT "propietarios_condicion_iva_id_fkey" FOREIGN KEY ("condicion_iva_id") REFERENCES "condiciones_iva"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_localidad_id_fkey" FOREIGN KEY ("localidad_id") REFERENCES "localidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_provincia_id_fkey" FOREIGN KEY ("provincia_id") REFERENCES "provincias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_tipo_propiedad_id_fkey" FOREIGN KEY ("tipo_propiedad_id") REFERENCES "tipos_propiedad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_estado_propiedad_id_fkey" FOREIGN KEY ("estado_propiedad_id") REFERENCES "estados_propiedad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_destino_id_fkey" FOREIGN KEY ("destino_id") REFERENCES "destinos_propiedad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_ambientes_id_fkey" FOREIGN KEY ("ambientes_id") REFERENCES "ambientes_propiedad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedad_propietario" ADD CONSTRAINT "propiedad_propietario_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedad_propietario" ADD CONSTRAINT "propiedad_propietario_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "propietarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedad_impuestos" ADD CONSTRAINT "propiedad_impuestos_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedad_impuestos" ADD CONSTRAINT "propiedad_impuestos_tipo_impuesto_id_fkey" FOREIGN KEY ("tipo_impuesto_id") REFERENCES "tipos_impuesto_propiedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedad_impuestos" ADD CONSTRAINT "propiedad_impuestos_periodicidad_id_fkey" FOREIGN KEY ("periodicidad_id") REFERENCES "periodicidades_impuesto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedad_cargos" ADD CONSTRAINT "propiedad_cargos_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedad_cargos" ADD CONSTRAINT "propiedad_cargos_tipo_cargo_id_fkey" FOREIGN KEY ("tipo_cargo_id") REFERENCES "tipos_cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedad_documento" ADD CONSTRAINT "propiedad_documento_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedad_documento" ADD CONSTRAINT "propiedad_documento_tipo_documento_id_fkey" FOREIGN KEY ("tipo_documento_id") REFERENCES "tipos_documento_propiedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilinos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_moneda_id_fkey" FOREIGN KEY ("moneda_id") REFERENCES "monedas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_metodo_ajuste_id_fkey" FOREIGN KEY ("metodo_ajuste_id") REFERENCES "metodos_ajuste_contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_estado_contrato_id_fkey" FOREIGN KEY ("estado_contrato_id") REFERENCES "estados_contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_responsabilidades" ADD CONSTRAINT "contrato_responsabilidades_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_responsabilidades" ADD CONSTRAINT "contrato_responsabilidades_tipo_impuesto_id_fkey" FOREIGN KEY ("tipo_impuesto_id") REFERENCES "tipos_impuesto_propiedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_responsabilidades" ADD CONSTRAINT "contrato_responsabilidades_quien_paga_proveedor_id_fkey" FOREIGN KEY ("quien_paga_proveedor_id") REFERENCES "actores_responsable_contrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_responsabilidades" ADD CONSTRAINT "contrato_responsabilidades_quien_soporta_costo_id_fkey" FOREIGN KEY ("quien_soporta_costo_id") REFERENCES "actores_responsable_contrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_garantias" ADD CONSTRAINT "contrato_garantias_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_garantias" ADD CONSTRAINT "contrato_garantias_tipo_garantia_id_fkey" FOREIGN KEY ("tipo_garantia_id") REFERENCES "tipos_garantia_contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_garantias" ADD CONSTRAINT "contrato_garantias_estado_garantia_id_fkey" FOREIGN KEY ("estado_garantia_id") REFERENCES "estados_garantia_contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_gastos_iniciales" ADD CONSTRAINT "contrato_gastos_iniciales_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_gastos_iniciales" ADD CONSTRAINT "contrato_gastos_iniciales_tipo_gasto_inicial_id_fkey" FOREIGN KEY ("tipo_gasto_inicial_id") REFERENCES "tipos_gasto_inicial_contrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_gastos_iniciales" ADD CONSTRAINT "contrato_gastos_iniciales_quien_paga_id_fkey" FOREIGN KEY ("quien_paga_id") REFERENCES "actores_responsable_contrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_ajuste" ADD CONSTRAINT "contrato_ajuste_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_estado_liquidacion_id_fkey" FOREIGN KEY ("estado_liquidacion_id") REFERENCES "estados_liquidacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_items" ADD CONSTRAINT "liquidacion_items_liquidacion_id_fkey" FOREIGN KEY ("liquidacion_id") REFERENCES "liquidaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_items" ADD CONSTRAINT "liquidacion_items_propiedad_impuesto_id_fkey" FOREIGN KEY ("propiedad_impuesto_id") REFERENCES "propiedad_impuestos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_items" ADD CONSTRAINT "liquidacion_items_tipo_cargo_id_fkey" FOREIGN KEY ("tipo_cargo_id") REFERENCES "tipos_cargo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_items" ADD CONSTRAINT "liquidacion_items_tipo_expensa_id_fkey" FOREIGN KEY ("tipo_expensa_id") REFERENCES "tipos_expensa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_items" ADD CONSTRAINT "liquidacion_items_estado_item_id_fkey" FOREIGN KEY ("estado_item_id") REFERENCES "estados_item_liquidacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_items" ADD CONSTRAINT "liquidacion_items_actor_facturado_id_fkey" FOREIGN KEY ("actor_facturado_id") REFERENCES "actores_responsable_contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_items" ADD CONSTRAINT "liquidacion_items_quien_soporta_costo_id_fkey" FOREIGN KEY ("quien_soporta_costo_id") REFERENCES "actores_responsable_contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;
