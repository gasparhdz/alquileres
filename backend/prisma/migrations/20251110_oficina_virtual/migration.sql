-- Add usuario_email and password fields to cuentas_tributarias table
ALTER TABLE "cuentas_tributarias"
    ADD COLUMN "usuario_email" TEXT,
    ADD COLUMN "password" TEXT;

-- Note: These fields store the credentials for accessing the online office (oficina virtual)
-- of each tax/service provider. The password field could be encrypted in the future for security.

