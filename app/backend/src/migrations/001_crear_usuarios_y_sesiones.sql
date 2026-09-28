-- =========================================================================
-- MIGRACIÓN 001: TABLAS DE USUARIOS NOMINALES Y SESIONES EN SERVIDOR
-- Cumple con spec.md v2.1 (Perfiles fijos: ADMINISTRADOR y TRABAJADOR)
-- =========================================================================

-- Tabla de Usuarios Nominales
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  correo VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  perfil VARCHAR(20) NOT NULL CHECK (perfil IN ('ADMINISTRADOR', 'TRABAJADOR')),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

-- Tabla de Sesiones Revocables en Servidor (Cookie HttpOnly / Secure)
CREATE TABLE IF NOT EXISTS sesiones (
  id VARCHAR(64) PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_en TIMESTAMP WITH TIME ZONE NOT NULL,
  revocada BOOLEAN NOT NULL DEFAULT FALSE,
  ip_creacion VARCHAR(45),
  creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_expiracion ON sesiones(expira_en);
