-- Domicilio fuera de Argentina: país ISO + texto libre (sin catálogo de localidades mundial)
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "pais_codigo" VARCHAR(2);
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "provincia_extranjera" VARCHAR(200);
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "localidad_extranjera" VARCHAR(200);
