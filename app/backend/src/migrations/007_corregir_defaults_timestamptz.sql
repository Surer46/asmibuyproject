-- =========================================================================
-- MIGRACIÓN 007: CORRECCIÓN DE DEFAULTS EN COLUMNAS TIMESTAMP WITH TIME ZONE
-- Resuelve Hallazgo A3-1-02 (Auditoría 3 - Integrante 1)
-- Coordinada con Integrantes 2, 3 y 4
-- Sustituye DEFAULT (NOW() AT TIME ZONE 'UTC') por DEFAULT CURRENT_TIMESTAMP (now())
-- para evitar desplazamiento de zona horaria (6 horas en America/Mexico_City)
-- =========================================================================

-- 1. Tablas de Módulo Plataforma y Accesos (Integrante 1)
ALTER TABLE usuarios 
  ALTER COLUMN creado_en SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE sesiones 
  ALTER COLUMN creado_en SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE schema_migraciones 
  ALTER COLUMN aplicado_en SET DEFAULT CURRENT_TIMESTAMP;

-- 2. Tablas de Módulo Catálogo e Inventario (Integrante 2)
ALTER TABLE ingredientes 
  ALTER COLUMN creado_en SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN actualizado_en SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE platillos 
  ALTER COLUMN creado_en SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN actualizado_en SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE receta_detalle 
  ALTER COLUMN creado_en SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE movimientos_inventario 
  ALTER COLUMN creado_en SET DEFAULT CURRENT_TIMESTAMP;

-- 3. Tablas de Módulo Descuentos y Promociones (Integrante 3)
ALTER TABLE promociones 
  ALTER COLUMN creado_en SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN actualizado_en SET DEFAULT CURRENT_TIMESTAMP;

-- 4. Tablas de Módulo Punto de Venta e Historial (Integrante 4)
ALTER TABLE ordenes 
  ALTER COLUMN creado_en SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN actualizado_en SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE orden_detalle 
  ALTER COLUMN creado_en SET DEFAULT CURRENT_TIMESTAMP;
