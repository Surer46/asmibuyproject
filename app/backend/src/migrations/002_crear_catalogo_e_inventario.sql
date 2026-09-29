-- =========================================================================
-- MIGRACIÓN 002: TABLAS DE CATÁLOGO E INVENTARIO
-- Cumple con spec.md v2.1 y docs/contratos/02-catalogo-inventario.md
-- Propietario: Integrante 2 (Catálogo e Inventario)
-- =========================================================================

-- 1. Tabla de Ingredientes (Insumos base)
CREATE TABLE IF NOT EXISTS ingredientes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  unidad VARCHAR(10) NOT NULL CHECK (unidad IN ('g', 'ml', 'pieza')),
  minimo NUMERIC(10, 3) NOT NULL DEFAULT 0.000 CHECK (minimo >= 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  actualizado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

-- 2. Tabla de Platillos (Catálogo para venta)
CREATE TABLE IF NOT EXISTS platillos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  precio NUMERIC(10, 2) NOT NULL CHECK (precio > 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  actualizado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

-- 3. Tabla de Receta Detalle (Relación Platillo - Ingrediente)
CREATE TABLE IF NOT EXISTS receta_detalle (
  id SERIAL PRIMARY KEY,
  platillo_id INTEGER NOT NULL REFERENCES platillos(id) ON DELETE RESTRICT,
  ingrediente_id INTEGER NOT NULL REFERENCES ingredientes(id) ON DELETE RESTRICT,
  cantidad NUMERIC(10, 3) NOT NULL CHECK (cantidad > 0),
  creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  CONSTRAINT uq_receta_platillo_ingrediente UNIQUE (platillo_id, ingrediente_id)
);

CREATE INDEX IF NOT EXISTS idx_receta_platillo ON receta_detalle(platillo_id);
CREATE INDEX IF NOT EXISTS idx_receta_ingrediente ON receta_detalle(ingrediente_id);

-- 4. Tabla de Movimientos de Inventario (Kárdex inmutable)
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id SERIAL PRIMARY KEY,
  ingrediente_id INTEGER NOT NULL REFERENCES ingredientes(id) ON DELETE RESTRICT,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ENTRADA', 'AJUSTE', 'CONSUMO_VENTA')),
  cantidad NUMERIC(10, 3) NOT NULL,
  motivo TEXT NOT NULL,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  orden_id INTEGER NULL,
  creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS idx_movimientos_ingrediente ON movimientos_inventario(ingrediente_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos_inventario(creado_en);
