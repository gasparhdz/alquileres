-- Add descripcion and ambientes fields to unidades table
ALTER TABLE "unidades"
    ADD COLUMN "ambientes" TEXT,
    ADD COLUMN "descripcion" TEXT;

