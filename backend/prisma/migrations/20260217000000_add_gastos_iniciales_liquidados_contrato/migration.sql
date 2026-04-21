-- AlterTable
ALTER TABLE "contratos" ADD COLUMN IF NOT EXISTS "gastos_iniciales_liquidados" BOOLEAN NOT NULL DEFAULT false;
