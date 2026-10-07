import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';

function encontrarDirectorioMigraciones(): string {
  const posiblesRutas = [
    __dirname,
    path.resolve(__dirname, '../../src/migrations'),
    path.resolve(__dirname, '../src/migrations'),
    path.resolve(process.cwd(), 'src/migrations'),
    path.resolve(process.cwd(), 'app/backend/src/migrations')
  ];

  for (const ruta of posiblesRutas) {
    if (fs.existsSync(ruta)) {
      const archivos = fs.readdirSync(ruta).filter((f) => f.endsWith('.sql'));
      if (archivos.length > 0) {
        return ruta;
      }
    }
  }

  throw new Error('No se encontraron archivos de migración .sql en ninguna de las rutas esperadas.');
}

async function ejecutarMigraciones() {
  console.log('====================================================');
  console.log('🚀 EJECUTANDO MIGRACIONES SQL - PROYECTO ASMIBUY');
  console.log('====================================================\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL no está configurada.');
    console.error('   Para migrar en Supabase o PostgreSQL local, configura DATABASE_URL.');
    console.error('====================================================');
    process.exit(1);
  }

  let client;
  try {
    client = await pool.connect();
  } catch (err: any) {
    console.error('❌ Error de conexión al conectar con la base de datos:', err.message);
    process.exit(1);
  }

  try {
    // 1. Asegurar tabla de historial de versiones de migración
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migraciones (
        nombre VARCHAR(255) PRIMARY KEY,
        aplicado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
      );
    `);

    // 2. Consultar migraciones ya aplicadas
    const resultadoPrevias = await client.query('SELECT nombre FROM schema_migraciones');
    const aplicadas = new Set<string>(resultadoPrevias.rows.map((r) => r.nombre));

    // 3. Obtener lista de migraciones disponibles
    const dirMigraciones = encontrarDirectorioMigraciones();
    console.log(`📁 Directorio de migraciones detectado: ${dirMigraciones}`);

    const sqlArchivos = fs
      .readdirSync(dirMigraciones)
      .filter((archivo) => archivo.endsWith('.sql'))
      .sort();

    if (sqlArchivos.length === 0) {
      throw new Error(`No se hallaron archivos .sql en ${dirMigraciones}`);
    }

    let migradas = 0;

    for (const archivo of sqlArchivos) {
      if (aplicadas.has(archivo)) {
        console.log(`⏭️ Migración omitida (ya aplicada): ${archivo}`);
        continue;
      }

      const sqlPath = path.join(dirMigraciones, archivo);
      const sql = fs.readFileSync(sqlPath, 'utf8');

      console.log(`⏳ Aplicando: ${archivo}...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migraciones (nombre) VALUES ($1)', [archivo]);
        await client.query('COMMIT');
        migradas++;
        console.log(`✅ Migración ${archivo} aplicada con éxito.`);
      } catch (sqlErr: any) {
        await client.query('ROLLBACK');
        throw new Error(`Fallo en migración ${archivo}: ${sqlErr.message}`);
      }
    }

    console.log(`\n✨ Proceso completado. ${migradas} migraciones nuevas aplicadas.`);
  } catch (err: any) {
    console.error('\n❌ ERROR CRÍTICO EN MIGRACIÓN:', err.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

ejecutarMigraciones();
