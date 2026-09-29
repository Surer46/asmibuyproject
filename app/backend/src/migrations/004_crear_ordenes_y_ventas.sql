-- =========================================================================
-- MIGRACIÓN 004: TABLAS DE ÓRDENES Y DETALLE DE VENTAS
-- Cumple con spec.md v2.1 y docs/contratos/04-ventas-reportes.md
-- Propietario: Integrante 4 (Punto de Venta e Historial)
-- =========================================================================

-- 1. Tabla de Órdenes de Venta
CREATE TABLE IF NOT EXISTS ordenes (
  id SERIAL PRIMARY KEY,
  folio VARCHAR(50) NOT NULL UNIQUE,
  clave_idempotencia VARCHAR(100) NOT NULL UNIQUE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  estado VARCHAR(20) NOT NULL CHECK (estado IN ('CONFIRMADA', 'ANULADA')),
  metodo_pago VARCHAR(20) NOT NULL CHECK (metodo_pago IN ('EFECTIVO', 'EXTERNO', 'SIN_COBRO')),
  subtotal_bruto NUMERIC(10, 2) NOT NULL CHECK (subtotal_bruto >= 0),
  descuento_total NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (descuento_total >= 0),
  total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
  promocion_id INTEGER NULL REFERENCES promociones(id),
  promocion_nombre VARCHAR(100) NULL,
  promocion_tipo VARCHAR(20) NULL,
  promocion_ahorro NUMERIC(10, 2) NULL,
  motivo_anulacion TEXT NULL,
  usuario_anulacion_id INTEGER NULL REFERENCES usuarios(id),
  anulado_en TIMESTAMP WITH TIME ZONE NULL,
  creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  actualizado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS idx_ordenes_folio ON ordenes(folio);
CREATE INDEX IF NOT EXISTS idx_ordenes_clave_idempotencia ON ordenes(clave_idempotencia);
CREATE INDEX IF NOT EXISTS idx_ordenes_usuario ON ordenes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON ordenes(estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_creado_en ON ordenes(creado_en);

-- 2. Tabla de Detalle de Órdenes (Partidas con copias históricas inmutables)
CREATE TABLE IF NOT EXISTS orden_detalle (
  id SERIAL PRIMARY KEY,
  orden_id INTEGER NOT NULL REFERENCES ordenes(id) ON DELETE RESTRICT,
  platillo_id INTEGER NOT NULL REFERENCES platillos(id) ON DELETE RESTRICT,
  nombre_platillo VARCHAR(100) NOT NULL,
  precio_unitario NUMERIC(10, 2) NOT NULL CHECK (precio_unitario > 0),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  unidades_cobradas INTEGER NOT NULL CHECK (unidades_cobradas >= 0),
  unidades_bonificadas INTEGER NOT NULL DEFAULT 0 CHECK (unidades_bonificadas >= 0),
  subtotal_bruto NUMERIC(10, 2) NOT NULL CHECK (subtotal_bruto >= 0),
  descuento NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (descuento >= 0),
  subtotal_neto NUMERIC(10, 2) NOT NULL CHECK (subtotal_neto >= 0),
  promocion_id INTEGER NULL REFERENCES promociones(id),
  creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS idx_orden_detalle_orden ON orden_detalle(orden_id);
CREATE INDEX IF NOT EXISTS idx_orden_detalle_platillo ON orden_detalle(platillo_id);
