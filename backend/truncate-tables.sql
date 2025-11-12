-- Script para truncar tablas y resetear secuencias
-- Ejecutar con cuidado: esto eliminará TODOS los datos de las tablas especificadas

-- Desactivar temporalmente las restricciones de foreign key para poder truncar en cualquier orden
SET session_replication_role = 'replica';

-- Truncar tablas en orden (primero las dependientes, luego las principales)
-- Usar CASCADE para truncar también las tablas dependientes automáticamente
TRUNCATE TABLE liquidacion_items CASCADE;
TRUNCATE TABLE liquidaciones CASCADE;
TRUNCATE TABLE contrato_ajuste CASCADE;
TRUNCATE TABLE contrato_gastos_iniciales CASCADE;
TRUNCATE TABLE contrato_responsabilidades CASCADE;
TRUNCATE TABLE garantias CASCADE;
TRUNCATE TABLE contratos CASCADE;
TRUNCATE TABLE cuentas_tributarias CASCADE;
TRUNCATE TABLE inquilinos CASCADE;

-- Reactivar las restricciones de foreign key
SET session_replication_role = 'origin';

-- Resetear secuencias para tablas con autoincrement
-- Nota: Las tablas con UUID no necesitan resetear secuencias
ALTER SEQUENCE IF EXISTS contrato_ajuste_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS indice_ajuste_id_seq RESTART WITH 1;

-- Verificar que las tablas estén vacías
SELECT 
    'liquidacion_items' as tabla, COUNT(*) as registros FROM liquidacion_items
UNION ALL
SELECT 'liquidaciones', COUNT(*) FROM liquidaciones
UNION ALL
SELECT 'contrato_ajuste', COUNT(*) FROM contrato_ajuste
UNION ALL
SELECT 'contrato_gastos_iniciales', COUNT(*) FROM contrato_gastos_iniciales
UNION ALL
SELECT 'contrato_responsabilidades', COUNT(*) FROM contrato_responsabilidades
UNION ALL
SELECT 'garantias', COUNT(*) FROM garantias
UNION ALL
SELECT 'contratos', COUNT(*) FROM contratos
UNION ALL
SELECT 'cuentas_tributarias', COUNT(*) FROM cuentas_tributarias
UNION ALL
SELECT 'inquilinos', COUNT(*) FROM inquilinos;

