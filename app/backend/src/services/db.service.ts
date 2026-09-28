import { PoolClient } from 'pg';
import { pool } from '../config/database';

/**
 * SERVICIO TRANSACCIONAL COMPARTIDO (CONTRATO W1-01 / W1-02)
 * Permite ejecutar operaciones atómicas pasando un único PoolClient
 * a través de múltiples repositorios (ej. Ventas + Inventario + Promociones).
 */
export async function ejecutarTransaccion<T>(
  operacion: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await operacion(client);
    await client.query('COMMIT');
    return resultado;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
