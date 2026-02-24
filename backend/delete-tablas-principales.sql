-- ============================================
-- Script para eliminar datos de tablas principales
-- Orden: primero las dependientes, luego las principales
-- ============================================

-- ADVERTENCIA: Este script eliminará TODOS los datos de estas tablas
-- Asegúrate de hacer un backup antes de ejecutar

-- Si hay una transacción abortada, primero hacer ROLLBACK
ROLLBACK;

BEGIN;

-- ============================================
-- 1. Eliminar items de liquidación PRIMERO
-- (depende de liquidaciones, propiedad_impuestos, propiedad_cargos)
-- ============================================

DELETE FROM liquidacion_items;

-- ============================================
-- 2. Eliminar liquidaciones
-- (depende de contratos y propiedades)
-- ============================================

DELETE FROM liquidaciones;

-- ============================================
-- 3. Eliminar tablas que dependen de CONTRATOS
-- ============================================

-- Eliminar responsabilidades de contratos
DELETE FROM contrato_responsabilidades;

-- Eliminar garantías de contratos
DELETE FROM contrato_garantias;

-- Eliminar gastos iniciales de contratos
DELETE FROM contrato_gastos_iniciales;

-- Eliminar ajustes de contratos
DELETE FROM contrato_ajuste;

-- ============================================
-- 4. Eliminar CONTRATOS
-- ============================================

DELETE FROM contratos;

-- ============================================
-- 5. Eliminar tablas que dependen de PROPIEDADES
-- ============================================

-- Eliminar campos de impuestos de propiedades (PRIMERO, antes de propiedad_impuestos)
DELETE FROM propiedad_impuesto_campos;

-- Eliminar campos de cargos de propiedades (PRIMERO, antes de propiedad_cargos)
DELETE FROM propiedad_cargo_campos;

-- Eliminar impuestos de propiedades
DELETE FROM propiedad_impuestos;

-- Eliminar cargos de propiedades
DELETE FROM propiedad_cargos;

-- Eliminar documentos de propiedades
DELETE FROM propiedad_documento;

-- Eliminar relación propiedad-propietario
DELETE FROM propiedad_propietario;

-- ============================================
-- 6. Eliminar PROPIEDADES
-- ============================================

DELETE FROM propiedades;

-- ============================================
-- 7. Eliminar INQUILINOS
-- ============================================

DELETE FROM inquilinos;

-- ============================================
-- 8. Eliminar PROPIETARIOS
-- ============================================

DELETE FROM propietarios;

-- ============================================
-- Verificar que se eliminaron los registros
-- ============================================

SELECT 
    'contratos' as tabla, COUNT(*) as registros FROM contratos
UNION ALL
SELECT 'propiedades', COUNT(*) FROM propiedades
UNION ALL
SELECT 'inquilinos', COUNT(*) FROM inquilinos
UNION ALL
SELECT 'propietarios', COUNT(*) FROM propietarios
UNION ALL
SELECT 'liquidaciones', COUNT(*) FROM liquidaciones
UNION ALL
SELECT 'liquidacion_items', COUNT(*) FROM liquidacion_items;

COMMIT;

-- ============================================
-- NOTAS:
-- - Si hay errores de foreign key, verifica que no queden
--   registros en otras tablas que referencien estas tablas
-- - Si la transacción se aborta, ejecuta ROLLBACK; antes de volver a intentar
-- ============================================
