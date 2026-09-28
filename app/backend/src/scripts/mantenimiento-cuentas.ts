/**
 * UTILIDAD DE MANTENIMIENTO DE CUENTAS NOMINALES (SPEC v2.1)
 * Permite al administrador crear o modificar cuentas desde terminal sin pantalla pública.
 * Uso: node dist/scripts/mantenimiento-cuentas.js [crear|listar] [nombre] [correo] [password] [ADMINISTRADOR|TRABAJADOR]
 */
import { AuthService } from '../services/auth.service';

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
    console.log(`✅ Cuenta nominal creada con éxito:`);
    console.log(`   - ID: ${u.id}`);
    console.log(`   - Nombre: ${u.nombre}`);
    console.log(`   - Correo: ${u.correo}`);
    console.log(`   - Perfil Fijo: ${u.perfil}`);
    console.log(`   - Activo: ${u.activo}`);
  } else {
    console.log('Cuentas nominales predeterminadas en el sistema:');
    console.log('1. [ADMINISTRADOR] Correo: admin@asmibuy.com   | Pass: Admin1234!');
    console.log('2. [TRABAJADOR]    Correo: cajero@asmibuy.com  | Pass: Cajero1234!');
  }

  console.log('\n========================================================');
}

main().catch(console.error);
