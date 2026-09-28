import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

// Configuración de pool con límites de Supabase Free (5-10 conexiones máximo)
export const pool = new Pool({
  connectionString: connectionString || undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: connectionString ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('⚠️ [PostgreSQL Pool Error inesperado]:', err.message);
});

/**
 * Verifica si la conexión con PostgreSQL / Supabase está activa
 */
export async function probarConexionBD(): Promise<{ conectada: boolean; detalle: string }> {
  if (!connectionString) {
    return {
      conectada: false,
      detalle: 'DATABASE_URL no configurada. Operando en modo desarrollo local seguro.'
    };
  }
  try {
    const cliente = await pool.connect();
    const res = await cliente.query('SELECT NOW() as fecha_servidor, version() as version_pg');
    cliente.release();
    return {
      conectada: true,
      detalle: `Conectado a PostgreSQL en Supabase. Hora servidor: ${res.rows[0].fecha_servidor}`
    };
  } catch (error: any) {
    return {
      conectada: false,
      detalle: `Fallo de conexión a base de datos: ${error.message}`
    };
  }
}
