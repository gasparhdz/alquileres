-- AlterTable: agregar columnas de 2do y 3er vencimiento e intereses en liquidaciones (según schema Prisma)
ALTER TABLE "liquidaciones" ADD COLUMN IF NOT EXISTS "vencimiento_2" TIMESTAMP(3);
ALTER TABLE "liquidaciones" ADD COLUMN IF NOT EXISTS "vencimiento_3" TIMESTAMP(3);
ALTER TABLE "liquidaciones" ADD COLUMN IF NOT EXISTS "interes_2" DECIMAL(5,2);
ALTER TABLE "liquidaciones" ADD COLUMN IF NOT EXISTS "interes_3" DECIMAL(5,2);
