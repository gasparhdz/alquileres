-- Eliminar el índice único antiguo (contrato_id, tipo_cargo_id) que quedó y provoca P2002
-- La migración anterior usó DROP CONSTRAINT pero era un INDEX
DROP INDEX IF EXISTS "contrato_responsabilidades_contrato_id_tipo_cargo_id_key";
