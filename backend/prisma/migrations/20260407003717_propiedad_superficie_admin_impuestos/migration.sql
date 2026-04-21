-- AlterTable
ALTER TABLE "propiedades" ADD COLUMN     "administra_impuestos_inmobiliaria" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "superficie_m2" DECIMAL(12,2);
