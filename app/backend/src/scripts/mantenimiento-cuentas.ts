/**
 * UTILIDAD DE MANTENIMIENTO DE CUENTAS NOMINALES (SPEC v2.1)
 * Permite al administrador crear, listar o desactivar cuentas desde terminal sin pantalla pública de usuarios.
 * Uso:
 *   node dist/scripts/mantenimiento-cuentas.js crear <nombre> <correo> - <ADMINISTRADOR|TRABAJADOR>
 *   node dist/scripts/mantenimiento-cuentas.js password <id> -
 *   node dist/scripts/mantenimiento-cuentas.js listar
 *   node dist/scripts/mantenimiento-cuentas.js desactivar <id>
 *   node dist/scripts/mantenimiento-cuentas.js activar <id>
 *
 * Contraseña: escribe "-" en su lugar y el script la pedirá por entrada oculta (dos veces), para que
 * no quede en el historial de la terminal (DCU-02). Pasarla como argumento sigue funcionando por
 * compatibilidad, pero no se recomienda.
 */
import { AuthService } from '../services/auth.service';
import { pool } from '../config/database';

/**
 * Lee una línea sin mostrarla en pantalla. Si la entrada no es una terminal (p. ej. tubería),
 * lee la línea tal cual sin eco.
 */
// Entrada no interactiva (tubería): se lee completa una sola vez y se reparte por líneas.
let lineasTuberia: Promise<string[]> | null = null;
function leerLineasTuberia(): Promise<string[]> {
  if (!lineasTuberia) {
    lineasTuberia = new Promise((resolve) => {
      let texto = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (trozo: string) => (texto += trozo));
      process.stdin.on('end', () => resolve(texto.split(/\r?\n/)));
      process.stdin.resume();
    });
  }
  return lineasTuberia;
}

function leerOculto(pregunta: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const entrada = process.stdin;
    process.stdout.write(pregunta);
    let valor = '';

    if (!entrada.isTTY) {
      leerLineasTuberia().then((lineas) => {
        process.stdout.write('\n');
        resolve(lineas.shift() ?? '');
      }, reject);
      return;
    }

    entrada.setRawMode(true);
    entrada.setEncoding('utf8');
    entrada.resume();
    const alTecla = (tecla: string) => {
      for (const c of tecla) {
        if (c === '\r' || c === '\n') {
          terminar();
          process.stdout.write('\n');
          resolve(valor);
          return;
        }
        if (c === '\u0003') {
          terminar();
          process.stdout.write('\n');
          reject(new Error('Operación cancelada.'));
          return;
        }
        if (c === '\u007f' || c === '\b') {
          valor = valor.slice(0, -1);
        } else {
          valor += c;
        }
      }
    };
    const terminar = () => {
      entrada.off('data', alTecla);
      entrada.setRawMode(false);
      entrada.pause();
    };
    entrada.on('data', alTecla);
  });
}

/** Devuelve la contraseña del argumento, o la pide oculta (con confirmación) si el argumento es "-". */
async function obtenerPassword(argumento: string | undefined): Promise<string | undefined> {
  if (argumento !== '-') {
    if (argumento) {
      console.log('⚠️ La contraseña como argumento queda en el historial de la terminal; usa "-" para escribirla oculta.');
    }
    return argumento;
  }
  const primera = await leerOculto('Contraseña (no se muestra): ');
  const segunda = await leerOculto('Repite la contraseña: ');
  if (!primera || primera !== segunda) {
    throw new Error('Las contraseñas no coinciden o están vacías.');
  }
  return primera;
}

async function main() {
  const args = process.argv.slice(2);
  const accion = args[0] || 'listar';

  console.log('========================================================');
  console.log('🛠️ UTILIDAD DE MANTENIMIENTO DE CUENTAS NOMINALES (ASMIBUY)');
  console.log('========================================================\n');

  if (accion === 'crear') {
    const [, nombre, correo, passwordArg, perfil] = args;
    if (!nombre || !correo || !passwordArg || !perfil) {
      console.log('Uso: node mantenimiento-cuentas.js crear <nombre> <correo> - <ADMINISTRADOR|TRABAJADOR>');
      console.log('     ("-" pide la contraseña por entrada oculta)');
      process.exit(1);
    }

    if (perfil !== 'ADMINISTRADOR' && perfil !== 'TRABAJADOR') {
      console.log('❌ Error: El perfil debe ser exactamente "ADMINISTRADOR" o "TRABAJADOR".');
      process.exit(1);
    }

    const password = (await obtenerPassword(passwordArg)) as string;

    const u = await AuthService.crearCuentaNominal(nombre, correo, password, perfil);
    console.log(`✅ Cuenta nominal creada con éxito en la base de datos:`);
    console.log(`   - ID: ${u.id}`);
    console.log(`   - Nombre: ${u.nombre}`);
    console.log(`   - Correo: ${u.correo}`);
    console.log(`   - Perfil Fijo: ${u.perfil}`);
    console.log(`   - Activo: ${u.activo}`);
  } else if (accion === 'desactivar') {
    const [, idStr] = args;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      console.log('Uso: node mantenimiento-cuentas.js desactivar <id_usuario>');
      process.exit(1);
    }
    const u = await AuthService.desactivarUsuario(id);
    console.log(`✅ Cuenta desactivada con éxito: ID ${u.id} (${u.nombre} - ${u.correo}) -> Activo: ${u.activo}`);
    console.log('   (Todas las sesiones activas de este usuario han sido revocadas en el servidor).');
  } else if (accion === 'activar') {
    const [, idStr] = args;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      console.log('Uso: node mantenimiento-cuentas.js activar <id_usuario>');
      process.exit(1);
    }
    const u = await AuthService.activarUsuario(id);
    console.log(`✅ Cuenta activada con éxito: ID ${u.id} (${u.nombre} - ${u.correo}) -> Activo: ${u.activo}`);
  } else if (accion === 'password' || accion === 'restablecer') {
    const [, idStr, passwordArg] = args;
    const id = parseInt(idStr, 10);
    if (isNaN(id) || !passwordArg) {
      console.log('Uso: node mantenimiento-cuentas.js password <id_usuario> -');
      console.log('     ("-" pide la nueva contraseña por entrada oculta)');
      process.exit(1);
    }
    const nuevoPassword = (await obtenerPassword(passwordArg)) as string;
    const u = await AuthService.restablecerPassword(id, nuevoPassword);
    console.log(`✅ Contraseña restablecida con éxito para ID ${u.id} (${u.nombre} - ${u.correo}).`);
    console.log('   (Todas sus sesiones activas previas han sido revocadas para exigir re-autenticación).');
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
