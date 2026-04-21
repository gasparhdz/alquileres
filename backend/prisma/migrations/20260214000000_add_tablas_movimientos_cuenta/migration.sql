-- Tablas de cuenta corriente: liquidaciones_propietario, movimientos_cuenta_inquilino, movimientos_cuenta_propietario.
-- Requieren que existan tipos_movimiento y medios_pago (migración 20260213000000).

-- CreateTable liquidaciones_propietario
CREATE TABLE "liquidaciones_propietario" (
    "id" SERIAL NOT NULL,
    "contrato_id" INTEGER,
    "propiedad_id" INTEGER,
    "periodo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alquiler_bruto" DECIMAL(12,2) NOT NULL,
    "honorarios_inmob" DECIMAL(12,2) NOT NULL,
    "gastos_deducibles" DECIMAL(12,2) NOT NULL,
    "otras_retenciones" DECIMAL(12,2) NOT NULL,
    "neto_a_pagar" DECIMAL(12,2) NOT NULL,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "liquidaciones_propietario_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "liquidaciones_propietario_contrato_id_periodo_key" ON "liquidaciones_propietario"("contrato_id", "periodo");
CREATE UNIQUE INDEX "liquidaciones_propietario_propiedad_id_periodo_key" ON "liquidaciones_propietario"("propiedad_id", "periodo");
CREATE INDEX "liquidaciones_propietario_contrato_id_periodo_idx" ON "liquidaciones_propietario"("contrato_id", "periodo");
CREATE INDEX "liquidaciones_propietario_propiedad_id_periodo_idx" ON "liquidaciones_propietario"("propiedad_id", "periodo");

ALTER TABLE "liquidaciones_propietario" ADD CONSTRAINT "liquidaciones_propietario_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "liquidaciones_propietario" ADD CONSTRAINT "liquidaciones_propietario_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable movimientos_cuenta_inquilino
CREATE TABLE "movimientos_cuenta_inquilino" (
    "id" SERIAL NOT NULL,
    "contrato_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo_movimiento_id" INTEGER NOT NULL,
    "concepto" TEXT NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,
    "liquidacion_id" INTEGER,
    "medio_pago_id" INTEGER,
    "nro_comprobante" TEXT,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "movimientos_cuenta_inquilino_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "movimientos_cuenta_inquilino_contrato_id_fecha_idx" ON "movimientos_cuenta_inquilino"("contrato_id", "fecha");
CREATE INDEX "movimientos_cuenta_inquilino_contrato_id_tipo_movimiento_id_idx" ON "movimientos_cuenta_inquilino"("contrato_id", "tipo_movimiento_id");

ALTER TABLE "movimientos_cuenta_inquilino" ADD CONSTRAINT "movimientos_cuenta_inquilino_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimientos_cuenta_inquilino" ADD CONSTRAINT "movimientos_cuenta_inquilino_tipo_movimiento_id_fkey" FOREIGN KEY ("tipo_movimiento_id") REFERENCES "tipos_movimiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimientos_cuenta_inquilino" ADD CONSTRAINT "movimientos_cuenta_inquilino_liquidacion_id_fkey" FOREIGN KEY ("liquidacion_id") REFERENCES "liquidaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "movimientos_cuenta_inquilino" ADD CONSTRAINT "movimientos_cuenta_inquilino_medio_pago_id_fkey" FOREIGN KEY ("medio_pago_id") REFERENCES "medios_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable movimientos_cuenta_propietario
CREATE TABLE "movimientos_cuenta_propietario" (
    "id" SERIAL NOT NULL,
    "contrato_id" INTEGER,
    "propiedad_id" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo_movimiento_id" INTEGER NOT NULL,
    "concepto" TEXT NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,
    "liquidacion_propietario_id" INTEGER,
    "medio_pago_id" INTEGER,
    "nro_comprobante" TEXT,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "movimientos_cuenta_propietario_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "movimientos_cuenta_propietario_contrato_id_fecha_idx" ON "movimientos_cuenta_propietario"("contrato_id", "fecha");
CREATE INDEX "movimientos_cuenta_propietario_contrato_id_tipo_movimiento_id_idx" ON "movimientos_cuenta_propietario"("contrato_id", "tipo_movimiento_id");

ALTER TABLE "movimientos_cuenta_propietario" ADD CONSTRAINT "movimientos_cuenta_propietario_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimientos_cuenta_propietario" ADD CONSTRAINT "movimientos_cuenta_propietario_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimientos_cuenta_propietario" ADD CONSTRAINT "movimientos_cuenta_propietario_tipo_movimiento_id_fkey" FOREIGN KEY ("tipo_movimiento_id") REFERENCES "tipos_movimiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimientos_cuenta_propietario" ADD CONSTRAINT "movimientos_cuenta_propietario_liquidacion_propietario_id_fkey" FOREIGN KEY ("liquidacion_propietario_id") REFERENCES "liquidaciones_propietario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "movimientos_cuenta_propietario" ADD CONSTRAINT "movimientos_cuenta_propietario_medio_pago_id_fkey" FOREIGN KEY ("medio_pago_id") REFERENCES "medios_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;
