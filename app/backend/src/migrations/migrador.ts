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
    const dirArchivos = fs.readdirSync(__dirname);
    const sqlArchivos = dirArchivos
      .filter((archivo) => archivo.endsWith('.sql'))
      .sort();

    for (const archivo of sqlArchivos) {
      const sqlPath = path.join(__dirname, archivo);
      const sql = fs.readFileSync(sqlPath, 'utf8');

      console.log(`Aplicando: ${archivo}...`);
      await client.query(sql);
      console.log(`✅ Migración ${archivo} aplicada.`);
    }

    console.log('\n✨ Todas las migraciones fueron procesadas exitosamente.');
  } catch (err: any) {
    console.error('❌ Error aplicando migraciones:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

ejecutarMigraciones();
