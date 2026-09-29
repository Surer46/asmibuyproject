-- =========================================================================
-- MIGRACIÓN 003: TABLA DE PROMOCIONES Y DESCUENTOS
-- Cumple con spec.md v2.1 y docs/contratos/03-promociones.md
-- Propietario: Integrante 3 (Descuentos y Promociones)
-- =========================================================================

CREATE TABLE IF NOT EXISTS promociones (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  platillo_id INTEGER NOT NULL REFERENCES platillos(id) ON DELETE RESTRICT,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('PORCENTAJE', 'NXM')),
  porcentaje NUMERIC(5, 2) NULL CHECK (porcentaje IS NULL OR (porcentaje > 0 AND porcentaje <= 100)),
  n INTEGER NULL CHECK (n IS NULL OR (n > 1)),
  m INTEGER NULL CHECK (m IS NULL OR (m >= 1)),
  duracion VARCHAR(20) NOT NULL CHECK (duracion IN ('TEMPORAL', 'PERMANENTE')),
  fecha_inicio TIMESTAMP WITH TIME ZONE NULL,
  fecha_fin TIMESTAMP WITH TIME ZONE NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'INACTIVA', 'RETIRADA')),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  actualizado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  
  -- Restricciones de integridad según tipo y duración
  CONSTRAINT chk_promocion_parametros_tipo CHECK (
    (tipo = 'PORCENTAJE' AND porcentaje IS NOT NULL AND n IS NULL AND m IS NULL) OR
    (tipo = 'NXM' AND n IS NOT NULL AND m IS NOT NULL AND n > m AND porcentaje IS NULL)
  ),
  CONSTRAINT chk_promocion_vigencia_duracion CHECK (
    (duracion = 'PERMANENTE' AND fecha_inicio IS NULL AND fecha_fin IS NULL) OR
    (duracion = 'TEMPORAL' AND fecha_inicio IS NOT NULL AND fecha_fin IS NOT NULL AND fecha_fin > fecha_inicio)
  )
);

CREATE INDEX IF NOT EXISTS idx_promociones_platillo ON promociones(platillo_id);
CREATE INDEX IF NOT EXISTS idx_promociones_estado ON promociones(estado);
CREATE INDEX IF NOT EXISTS idx_promociones_vigencia ON promociones(fecha_inicio, fecha_fin);
