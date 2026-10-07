/**
 * UTILIDAD DE MANTENIMIENTO DE CUENTAS NOMINALES (SPEC v2.1)
 * Permite al administrador crear, listar o desactivar cuentas desde terminal sin pantalla pública de usuarios.
 * Uso:
 *   node dist/scripts/mantenimiento-cuentas.js crear <nombre> <correo> <password> <ADMINISTRADOR|TRABAJADOR>
 *   node dist/scripts/mantenimiento-cuentas.js listar
 *   node dist/scripts/mantenimiento-cuentas.js desactivar <id>
 *   node dist/scripts/mantenimiento-cuentas.js activar <id>
 */
import { AuthService } from '../services/auth.service';
import { pool } from '../config/database';

async function main() {
  const args = process.argv.slice(2);
  const accion = args[0] || 'listar';

  console.log('========================================================');
  console.log('🛠️ UTILIDAD DE MANTENIMIENTO DE CUENTAS NOMINALES (ASMIBUY)');
  console.log('========================================================\n');

  if (accion === 'crear') {
    const [, nombre, correo, password, perfil] = args;
    if (!nombre || !correo || !password || !perfil) {
      console.log('Uso: node mantenimiento-cuentas.js crear <nombre> <correo> <password> <ADMINISTRADOR|TRABAJADOR>');
      process.exit(1);
    }

    if (perfil !== 'ADMINISTRADOR' && perfil !== 'TRABAJADOR') {
      console.log('❌ Error: El perfil debe ser exactamente "ADMINISTRADOR" o "TRABAJADOR".');
      process.exit(1);
    }

    const u = await AuthService.crearCuentaNominal(nombre, correo, password, perfil);
    console.log(`✅ Cuenta nominal creada con éxito en la base de datos:`);
    console.log(`   - ID: ${u.id}`);
    console.log(`   - Nombre: ${u.nombre}`);
    console.log(`   - Correo: ${u.correo}`);
    console.log(`   - Perfil Fijo: ${u.perfil}`);
    console.log(`   - Activo: ${u.activo}`);
  } else if (accion === 'desactivar' || accion === 'activar') {
    const [, idStr] = args;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      console.log(`Uso: node mantenimiento-cuentas.js ${accion} <id_usuario>`);
      process.exit(1);
    }
    const nuevoEstado = accion === 'activar';
    const res = await pool.query('UPDATE usuarios SET activo = $1 WHERE id = $2 RETURNING id, nombre, correo, perfil, activo', [nuevoEstado, id]);
    if (res.rows.length === 0) {
      console.log(`❌ No se encontró usuario con ID ${id}`);
    } else {
      const u = res.rows[0];
      console.log(`✅ Cuenta actualizada: ID ${u.id} (${u.nombre} - ${u.correo}) -> Activo: ${u.activo}`);
    }
  } else {
    if (!process.env.DATABASE_URL) {
      console.log('⚠️ DATABASE_URL no configurada. Configure la variable para listar usuarios de la BD.');
    } else {
      const res = await pool.query('SELECT id, nombre, correo, perfil, activo, creado_en FROM usuarios ORDER BY id ASC');
      if (res.rows.length === 0) {
        console.log('ℹ️ No hay cuentas registradas en la base de datos.');
        console.log('   Usa: node dist/scripts/mantenimiento-cuentas.js crear <nombre> <correo> <password> <ADMINISTRADOR|TRABAJADOR>');
      } else {
        console.log(`Listado de cuentas nominales registradas (${res.rows.length}):`);
        res.rows.forEach((u) => {
          console.log(` • ID: ${u.id} | ${u.perfil.padEnd(14)} | ${u.correo.padEnd(25)} | Activo: ${u.activo ? 'SÍ' : 'NO'} | Nombre: ${u.nombre}`);
        });
      }
    }
  }

  console.log('\n========================================================');
  await pool.end();
}

main().catch((err) => {
  console.error('❌ Error en mantenimiento de cuentas:', err.message);
  process.exit(1);
});
