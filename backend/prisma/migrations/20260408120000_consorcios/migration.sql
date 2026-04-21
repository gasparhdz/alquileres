-- CreateTable
CREATE TABLE "consorcios" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "cuit_consorcio" VARCHAR(20),
    "direccion_consorcio" VARCHAR(500),
    "nombre_administracion" VARCHAR(255),
    "direccion_administracion" VARCHAR(500),
    "nombre_referente" VARCHAR(255),
    "telefono_administracion" VARCHAR(100),
    "mail_administracion" VARCHAR(255),
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" INTEGER,

    CONSTRAINT "consorcios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consorcios_activo_idx" ON "consorcios"("activo");

-- AlterTable
ALTER TABLE "propiedades" ADD COLUMN "consorcio_id" INTEGER;

-- AddForeignKey
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_consorcio_id_fkey" FOREIGN KEY ("consorcio_id") REFERENCES "consorcios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Permisos consorcios (idempotente)
INSERT INTO "permisos" ("codigo", "nombre", "descripcion", "activo", "created_at", "updated_at")
VALUES
  ('consorcios.ver', 'Ver consorcios', 'Permite ver el listado de consorcios', true, NOW(), NOW()),
  ('consorcios.crear', 'Crear consorcios', 'Permite crear consorcios', true, NOW(), NOW()),
  ('consorcios.editar', 'Editar consorcios', 'Permite editar consorcios', true, NOW(), NOW()),
  ('consorcios.eliminar', 'Eliminar consorcios', 'Permite eliminar consorcios', true, NOW(), NOW())
ON CONFLICT ("codigo") DO UPDATE SET
  "nombre" = EXCLUDED."nombre",
  "descripcion" = EXCLUDED."descripcion",
  "activo" = EXCLUDED."activo",
  "updated_at" = NOW();
