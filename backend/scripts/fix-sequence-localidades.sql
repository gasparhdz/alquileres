-- Si al INSERT en localidades falla "duplicate key value violates unique constraint localidades_pkey"
-- la secuencia del id quedó por debajo del MAX(id). Ejecutar una vez:
SELECT setval(
  pg_get_serial_sequence('localidades', 'id'),
  COALESCE((SELECT MAX(id) FROM localidades), 1)
);
