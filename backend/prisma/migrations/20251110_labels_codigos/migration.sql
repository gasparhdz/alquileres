-- Add label fields for codigo1 and codigo2 to parametros table
ALTER TABLE "parametros"
    ADD COLUMN "label_codigo_1" TEXT,
    ADD COLUMN "label_codigo_2" TEXT;

