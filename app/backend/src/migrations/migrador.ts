import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';

async function ejecutarMigraciones() {
  console.log('====================================================');
  console.log('🚀 EJECUTANDO MIGRACIONES SQL - PROYECTO ASMIBUY');
  console.log('====================================================\n');

  if (!process.env.DATABASE_URL) {
    console.log('ℹ️ DATABASE_URL no está configurada.');
    console.log('   Para migrar en Supabase, agrega DATABASE_URL en app/backend/.env');
    console.log('====================================================');
    return;
  }

  const client = await pool.connect();
  try {
    const sqlPath = path.join(__dirname, '001_crear_usuarios_y_sesiones.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Aplicando: 001_crear_usuarios_y_sesiones.sql...');
    await client.query(sql);
    console.log('✅ Migración aplicada exitosamente en PostgreSQL / Supabase.');
  } catch (err: any) {
    console.error('❌ Error aplicando migraciones:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

ejecutarMigraciones();
