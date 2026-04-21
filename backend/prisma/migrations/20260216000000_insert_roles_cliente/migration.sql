-- Insertar roles de cliente por defecto (por si el seed no se ejecutó).
INSERT INTO roles_cliente (codigo, nombre, activo)
VALUES
  ('INQUILINO', 'Inquilino', true),
  ('PROPIETARIO', 'Propietario', true),
  ('GARANTE', 'Garante', true)
ON CONFLICT (codigo) DO NOTHING;
