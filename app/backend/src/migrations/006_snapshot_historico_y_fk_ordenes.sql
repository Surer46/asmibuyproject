-- =========================================================================
-- MIGRACIÓN 006: SNAPSHOT HISTÓRICO COMPLETO Y FK DE ORDENES EN MOVIMIENTOS
-- Cumple con Hallazgo 7 de Auditoría 1 (W4-01 / W4-04 / CW-15)
-- Propietario: Integrante 4 (Punto de Venta e Historial)
-- =========================================================================

-- 1. Agregar restricción de clave foránea en movimientos_inventario.orden_id -> ordenes.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_movimientos_orden'
  ) THEN
    ALTER TABLE movimientos_inventario
      ADD CONSTRAINT fk_movimientos_orden
      FOREIGN KEY (orden_id) REFERENCES ordenes(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- 2. Snapshot histórico extendido de la regla de promoción en ordenes
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS promocion_porcentaje NUMERIC(5, 2) NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS promocion_n INTEGER NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS promocion_m INTEGER NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS promocion_vigencia_inicio TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS promocion_vigencia_fin TIMESTAMP WITH TIME ZONE NULL;

-- 3. Snapshot histórico de la receta/insumos consumidos por partida en orden_detalle
ALTER TABLE orden_detalle ADD COLUMN IF NOT EXISTS receta_snapshot JSONB NULL;
