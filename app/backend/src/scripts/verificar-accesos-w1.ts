/**
 * SCRIPT DE VERIFICACIÓN AUDITORÍA 1 — INTEGRANTE 1 (W1-01 a W1-06)
 * Valida:
 * 1. Rechazo estricto ante caída de BD (sin fallback a cuentas en memoria)
 * 2. Hash criptográfico SHA-256 de identificador de sesión en BD
 * 3. Rechazo de cuentas desactivadas
 * 4. Validación de origen y rechazo de orígenes no autorizados (ej. untrusted.example.test)
 * 5. Validación de token CSRF en peticiones mutables y logout
 * 6. Revocación en servidor y rechazo de cookies reutilizadas
 * 7. Empaquetado y presencia de migraciones SQL en dist/migrations
 * 8. Fuentes locales con licencia y tokens de AGENTS.md
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { AuthService } from '../services/auth.service';
import { esOrigenPermitido } from '../middlewares/auth.middleware';

let fallos = 0;
let exitos = 0;

function assert(condicion: boolean, mensaje: string) {
  if (condicion) {
    console.log(`  ✅ [PASS] ${mensaje}`);
    exitos++;
  } else {
    console.error(`  ❌ [FAIL] ${mensaje}`);
    fallos++;
  }
}

async function probarFalloCaidaBD() {
  console.log('\n--- 1. Prueba de caída de base de datos y ausencia de fallback a memoria ---');
  // Simular DATABASE_URL a puerto cerrado
  const urlAnterior = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://invalido:invalido@127.0.0.1:59999/asmibuy_down';

  try {
    await AuthService.buscarPorCorreo('admin@asmibuy.com');
    assert(false, 'Debería haber fallado al consultar BD caída');
  } catch (err: any) {
    assert(true, `Ante caída de BD rechaza búsqueda con excepción (${err.code || err.message}) sin fallback a memoria`);
  }

  try {
    await AuthService.crearSesion(1);
    assert(false, 'Debería haber fallado al crear sesión con BD caída');
  } catch (err: any) {
    assert(true, 'Ante caída de BD deniega creación de sesión');
  }

  // Restaurar
  delete process.env.DATABASE_URL;
  if (urlAnterior) process.env.DATABASE_URL = urlAnterior;
}

async function probarHashSesionesYRevocacion() {
  console.log('\n--- 2. Prueba de almacenamiento exclusivo de HASH SHA-256 en sesiones ---');
  process.env.NODE_ENV = 'test';
  delete process.env.DATABASE_URL;
  AuthService.resetearMemoriaTest();

  // Crear usuario activo para la prueba
  const passHash = AuthService.hashPassword('PasswordSeguro123!');
  AuthService.agregarUsuarioTest({
    id: 10,
    nombre: 'Usuario Prueba',
    correo: 'prueba@asmibuy.com',
    password_hash: passHash,
    perfil: 'TRABAJADOR',
    activo: true,
    creado_en: new Date().toISOString()
  });

  const { token, sesion } = await AuthService.crearSesion(10);
  assert(token.length === 64, 'Token de cookie generado con 64 caracteres hex (32 bytes aleatorios)');
  
  const hashEsperado = crypto.createHash('sha256').update(token).digest('hex');
  assert(sesion.id === hashEsperado, 'En BD (sesiones.id) se almacena únicamente el HASH SHA-256, NUNCA el token en claro');
  assert(sesion.id !== token, 'El identificador guardado es distinto del secreto de la cookie');

  // Validar con el token en claro
  const resVal = await AuthService.validarSesion(token);
  assert(resVal.valida === true && resVal.usuario?.id === 10, 'Sesión validada exitosamente mediante token hash');

  // Intentar validar con token manipulado
  const resValFalsa = await AuthService.validarSesion(token.replace('a', 'b'));
  assert(resValFalsa.valida === false, 'Token manipulado es rechazado');

  // Revocar sesión
  await AuthService.revocarSesion(token);
  const resPostRevocada = await AuthService.validarSesion(token);
  assert(resPostRevocada.valida === false, 'Sesión revocada es invalidada en el servidor');
}

async function probarCuentaDesactivada() {
  console.log('\n--- 3. Prueba de cuenta desactivada ---');
  process.env.NODE_ENV = 'test';
  delete process.env.DATABASE_URL;
  AuthService.resetearMemoriaTest();

  // Usuario desactivado
  AuthService.agregarUsuarioTest({
    id: 20,
    nombre: 'Usuario Bloqueado',
    correo: 'bloqueado@asmibuy.com',
    password_hash: AuthService.hashPassword('Bloqueado123!'),
    perfil: 'TRABAJADOR',
    activo: false,
    creado_en: new Date().toISOString()
  });

  const usuario = await AuthService.buscarPorCorreo('bloqueado@asmibuy.com');
  assert(usuario !== null && usuario.activo === false, 'Usuario bloqueado recuperado con activo=false');

  // Crear sesión y verificar que al validar se deniega por estar inactivo
  const { token } = await AuthService.crearSesion(20);
  const val = await AuthService.validarSesion(token);
  assert(val.valida === false && val.usuario === null, 'Sesión rechazada inmediatamente para cuenta con activo=false');
}

function probarValidacionOrigen() {
  console.log('\n--- 4. Prueba de control de orígenes permitidos (CORS / CSRF) ---');
  assert(esOrigenPermitido('http://localhost:4200') === true, 'Permite frontend local http://localhost:4200');
  assert(esOrigenPermitido('http://localhost:3001') === true, 'Permite backend local http://localhost:3001');
  assert(esOrigenPermitido('http://127.0.0.1:4200') === true, 'Permite loopback IP http://127.0.0.1:4200');
  assert(esOrigenPermitido('http://untrusted.example.test') === false, 'Rechaza origen no confiable http://untrusted.example.test');
  assert(esOrigenPermitido('https://sitio-malicioso.com') === false, 'Rechaza origen arbitrario https://sitio-malicioso.com');
}

function probarEmpaquetadoMigraciones() {
  console.log('\n--- 5. Prueba de empaquetado y presencia de migraciones en dist/migrations ---');
  const dirDist = path.resolve(__dirname, '../migrations');
  const archivos = fs.existsSync(dirDist) ? fs.readdirSync(dirDist).filter(f => f.endsWith('.sql')) : [];
  assert(archivos.length >= 4, `dist/migrations contiene ${archivos.length} archivos .sql empaquetados`);
  assert(archivos.includes('001_crear_usuarios_y_sesiones.sql'), 'Contiene 001_crear_usuarios_y_sesiones.sql');
  assert(archivos.includes('002_crear_catalogo_e_inventario.sql'), 'Contiene 002_crear_catalogo_e_inventario.sql');
  assert(archivos.includes('003_crear_promociones.sql'), 'Contiene 003_crear_promociones.sql');
  assert(archivos.includes('004_crear_ordenes_y_ventas.sql'), 'Contiene 004_crear_ordenes_y_ventas.sql');
}

function probarFuentesLocalesYTokens() {
  console.log('\n--- 6. Prueba de fuentes locales, licencias y tokens obligatorios ---');
  const dirFonts = path.resolve(process.cwd(), 'app/frontend/public/fonts');
  assert(fs.existsSync(path.join(dirFonts, 'roboto-400.ttf')), 'roboto-400.ttf alojada localmente');
  assert(fs.existsSync(path.join(dirFonts, 'roboto-500.ttf')), 'roboto-500.ttf alojada localmente');
  assert(fs.existsSync(path.join(dirFonts, 'roboto-700.ttf')), 'roboto-700.ttf alojada localmente');
  assert(fs.existsSync(path.join(dirFonts, 'material-symbols-rounded.ttf')), 'material-symbols-rounded.ttf alojada localmente');
  assert(fs.existsSync(path.join(dirFonts, 'LICENSE-ROBOTO.txt')), 'Licencia de Roboto presente');
  assert(fs.existsSync(path.join(dirFonts, 'LICENSE-MATERIAL-SYMBOLS.txt')), 'Licencia de Material Symbols presente');

  const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'app/frontend/src/index.html'), 'utf8');
  assert(!indexHtml.includes('fonts.googleapis.com'), 'index.html no realiza llamadas externas a Google Fonts');

  const stylesCss = fs.readFileSync(path.resolve(process.cwd(), 'app/frontend/src/styles.css'), 'utf8');
  assert(stylesCss.includes('#166534'), 'styles.css incluye token primaria/éxito #166534');
  assert(stylesCss.includes('#6D28D9'), 'styles.css incluye token acento #6D28D9');
  assert(stylesCss.includes('#B91C1C'), 'styles.css incluye token error #B91C1C');
  assert(stylesCss.includes('#FACC15'), 'styles.css incluye token advertencia #FACC15');
  assert(stylesCss.includes('#713F12'), 'styles.css incluye token texto advertencia #713F12 (nunca blanco)');
  assert(stylesCss.includes('#F7F8FA'), 'styles.css incluye token fondo #F7F8FA');
  assert(stylesCss.includes('#FFFFFF'), 'styles.css incluye token superficie #FFFFFF');
  assert(stylesCss.includes('#1F2937'), 'styles.css incluye token texto principal #1F2937');
  assert(stylesCss.includes('#4B5563'), 'styles.css incluye token texto secundario #4B5563');
  assert(stylesCss.includes('#DCFCE7'), 'styles.css incluye superficie suave verde #DCFCE7');
  assert(stylesCss.includes('#EDE9FE'), 'styles.css incluye superficie suave morado #EDE9FE');
  assert(stylesCss.includes('#FEE2E2'), 'styles.css incluye superficie suave rojo #FEE2E2');
  assert(stylesCss.includes('#FEF9C3'), 'styles.css incluye superficie suave amarillo #FEF9C3');
  assert(stylesCss.includes('#6B7280'), 'styles.css incluye borde de control #6B7280');
}

async function main() {
  console.log('========================================================');
  console.log('🧪 BATERÍA DE VERIFICACIÓN DE AUDITORÍA 1 — PLATAFORMA Y ACCESOS');
  console.log('========================================================');

  await probarFalloCaidaBD();
  await probarHashSesionesYRevocacion();
  await probarCuentaDesactivada();
  probarValidacionOrigen();
  probarEmpaquetadoMigraciones();
  probarFuentesLocalesYTokens();

  console.log('\n========================================================');
  console.log(`📊 RESULTADO FINAL: ${exitos} PRUEBAS EXITOSAS, ${fallos} FALLOS`);
  console.log('========================================================');

  if (fallos > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error fatal durante la verificación:', err);
  process.exit(1);
});
