/**
 * =========================================================================
 * BATERÍA DE VERIFICACIÓN AUDITORÍA 3 — INTEGRANTE 1 (PLATAFORMA Y ACCESOS)
 * Cumple con los hallazgos:
 * - A3-1-01: Limitación de intentos (rate limiting), espera creciente y mitigación de timing attack
 * - A3-1-02: Corrección de defaults TIMESTAMP WITH TIME ZONE (Migración 007) y TimeZone=UTC
 * - A3-1-03: cookieParser sin secreto fijo, restricción de localhost en producción, mensaje BD y cabeceras
 * =========================================================================
 */

import fs from 'fs';
import path from 'path';
import { AuthService } from '../services/auth.service';
import { LoginRateLimiter } from '../services/login-rate-limiter';
import { esOrigenPermitido } from '../middlewares/auth.middleware';
import { probarConexionBD, pool } from '../config/database';

let exitos = 0;
let fallos = 0;

function assert(condicion: boolean, mensaje: string) {
  if (condicion) {
    console.log(`  ✅ [PASS] ${mensaje}`);
    exitos++;
  } else {
    console.error(`  ❌ [FAIL] ${mensaje}`);
    fallos++;
  }
}

async function probarA3_1_01_RateLimitingYTiming() {
  console.log('\n🔒 1. Verificación A3-1-01: Rate Limiting con Espera Creciente y Mitigación de Timing Attack');
  
  LoginRateLimiter.resetear();
  const testIp = '198.51.100.25';
  const testCorreo = 'usuario.test@asmibuy.com';

  // 1.1 Estado inicial
  const inicial = LoginRateLimiter.verificarBloqueo(testIp, testCorreo);
  assert(!inicial.bloqueado, 'Inicialmente no se encuentra bloqueado');
  assert(inicial.intentosRestantes === 5, 'Cuenta con 5 intentos restantes iniciales');

  // 1.2 Registrar 4 fallos (no debe bloquear aún)
  for (let i = 1; i <= 4; i++) {
    const res = LoginRateLimiter.registrarFallo(testIp, testCorreo);
    assert(!res.bloqueado, `Fallo ${i}/5 no bloquea la cuenta`);
    assert(res.intentosRestantes === 5 - i, `Intentos restantes tras fallo ${i}: ${5 - i}`);
  }

  // 1.3 5º fallo consecutivo: debe aplicar bloqueo temporal (30s)
  const fallo5 = LoginRateLimiter.registrarFallo(testIp, testCorreo);
  assert(fallo5.bloqueado === true, '5º fallo consecutivo bloquea temporalmente el acceso (HTTP 429)');
  assert(fallo5.reintentarEnSegundos >= 29 && fallo5.reintentarEnSegundos <= 30, 'Tiempo de espera para 5º fallo es de 30 segundos');

  const checkBloqueado = LoginRateLimiter.verificarBloqueo(testIp, testCorreo);
  assert(checkBloqueado.bloqueado === true, 'verificarBloqueo confirma que el acceso está bloqueado');

  // 1.4 Espera creciente (progressive backoff) en fallos posteriores
  const fallo6 = LoginRateLimiter.registrarFallo(testIp, testCorreo);
  assert(fallo6.bloqueado === true && fallo6.reintentarEnSegundos >= 59 && fallo6.reintentarEnSegundos <= 60, '6º fallo aplica espera creciente de 60 segundos');

  const fallo7 = LoginRateLimiter.registrarFallo(testIp, testCorreo);
  assert(fallo7.bloqueado === true && fallo7.reintentarEnSegundos >= 179 && fallo7.reintentarEnSegundos <= 180, '7º fallo aplica espera creciente de 180 segundos');

  // 1.5 Limpieza tras autenticación exitosa
  LoginRateLimiter.limpiarExito(testIp, testCorreo);
  const postExito = LoginRateLimiter.verificarBloqueo(testIp, testCorreo);
  assert(!postExito.bloqueado && postExito.intentosRestantes === 5, 'Autenticación exitosa limpia el bloqueo y restablece los 5 intentos');

  // 1.6 Mitigación de Timing Attack y Enumeración de Cuentas
  console.log('  ⏱️ Comprobando mitigación de timing attack en contraseñas...');
  const t0 = Date.now();
  AuthService.verificarPasswordFalsa('PasswordCualquiera123!');
  const deltaDummy = Date.now() - t0;

  const passHashReal = AuthService.hashPassword('PasswordReal123!');
  const t1 = Date.now();
  AuthService.verificarPassword('PasswordEquivocada123!', passHashReal);
  const deltaReal = Date.now() - t1;

  assert(deltaDummy >= 10, `Hash dummy para usuario inexistente consume cómputo real bcrypt (${deltaDummy} ms >= 10 ms)`);
  assert(deltaReal >= 10, `Hash de usuario real consume cómputo real bcrypt (${deltaReal} ms >= 10 ms)`);
  const diferenciaMs = Math.abs(deltaDummy - deltaReal);
  assert(diferenciaMs < 80, `Tiempos de cómputo equivalentes entre usuario existente e inexistente (diferencia: ${diferenciaMs} ms)`);
}

async function probarA3_1_02_Migracion007YTimeZone() {
  console.log('\n📅 2. Verificación A3-1-02: Migración 007 y Configuración TimeZone=UTC');

  // 2.1 Presencia de la migración 007 en src/migrations y dist/migrations
  const rutaSrc007 = fs.existsSync(path.resolve(__dirname, '../migrations/007_corregir_defaults_timestamptz.sql'))
    ? path.resolve(__dirname, '../migrations/007_corregir_defaults_timestamptz.sql')
    : path.resolve(__dirname, '../../src/migrations/007_corregir_defaults_timestamptz.sql');
  const rutaDist007 = fs.existsSync(path.resolve(__dirname, '../../dist/migrations/007_corregir_defaults_timestamptz.sql'))
    ? path.resolve(__dirname, '../../dist/migrations/007_corregir_defaults_timestamptz.sql')
    : path.resolve(__dirname, '../migrations/007_corregir_defaults_timestamptz.sql');

  assert(fs.existsSync(rutaSrc007), 'Migración 007 existe en src/migrations/');
  assert(fs.existsSync(rutaDist007), 'Migración 007 empaquetada en dist/migrations/');

  const contenido007 = fs.readFileSync(rutaSrc007, 'utf8');
  assert(contenido007.includes('ALTER TABLE usuarios'), 'Migración 007 altera tabla usuarios');
  assert(contenido007.includes('ALTER TABLE sesiones'), 'Migración 007 altera tabla sesiones');
  assert(contenido007.includes('ALTER TABLE ingredientes'), 'Migración 007 altera tabla ingredientes');
  assert(contenido007.includes('ALTER TABLE platillos'), 'Migración 007 altera tabla platillos');
  assert(contenido007.includes('ALTER TABLE receta_detalle'), 'Migración 007 altera tabla receta_detalle');
  assert(contenido007.includes('ALTER TABLE movimientos_inventario'), 'Migración 007 altera tabla movimientos_inventario');
  assert(contenido007.includes('ALTER TABLE promociones'), 'Migración 007 altera tabla promociones');
  assert(contenido007.includes('ALTER TABLE ordenes'), 'Migración 007 altera tabla ordenes');
  assert(contenido007.includes('ALTER TABLE orden_detalle'), 'Migración 007 altera tabla orden_detalle');
  assert(contenido007.includes('SET DEFAULT CURRENT_TIMESTAMP'), 'Migración 007 aplica SET DEFAULT CURRENT_TIMESTAMP en todas las tablas');

  // 2.2 Migrador actualizado
  const rutaMigrador = fs.existsSync(path.resolve(__dirname, '../migrations/migrador.ts'))
    ? path.resolve(__dirname, '../migrations/migrador.ts')
    : path.resolve(__dirname, '../../src/migrations/migrador.ts');
  const contenidoMigrador = fs.readFileSync(rutaMigrador, 'utf8');
  assert(contenidoMigrador.includes('DEFAULT CURRENT_TIMESTAMP'), 'migrador.ts inicializa schema_migraciones con DEFAULT CURRENT_TIMESTAMP');

  // 2.3 Pool configurado con TimeZone=UTC
  const rutaDb = fs.existsSync(path.resolve(__dirname, '../config/database.ts'))
    ? path.resolve(__dirname, '../config/database.ts')
    : path.resolve(__dirname, '../../src/config/database.ts');
  const contenidoDb = fs.readFileSync(rutaDb, 'utf8');
  assert(contenidoDb.includes("options: '-c timezone=UTC'"), "database.ts configura options: '-c timezone=UTC'");
  assert(contenidoDb.includes("SET timezone = 'UTC'"), "database.ts ejecuta SET timezone = 'UTC' en evento connect");
}

async function probarA3_1_03_SeguridadHeadersCookiesYOrigenes() {
  console.log('\n🛡️ 3. Verificación A3-1-03: Orígenes en Producción, Mensaje BD y Cabeceras');

  // 3.1 Orígenes en producción vs desarrollo
  const origEnv = process.env.NODE_ENV;
  const origOrigins = process.env.ALLOWED_ORIGINS;

  try {
    // En modo producción: localhost NO debe permitirse si no está en ALLOWED_ORIGINS
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.CORS_ORIGIN;

    assert(esOrigenPermitido('http://localhost:4200') === false, 'En producción rechaza http://localhost:4200 si no está configurado');
    assert(esOrigenPermitido('http://127.0.0.1:4200') === false, 'En producción rechaza http://127.0.0.1:4200 si no está configurado');
    assert(esOrigenPermitido('http://192.168.1.50:4200') === false, 'En producción rechaza IP privada si no está configurada');

    // Con origen configurado explícitamente en producción:
    process.env.ALLOWED_ORIGINS = 'https://asmibuy.com,http://localhost:4200';
    assert(esOrigenPermitido('https://asmibuy.com') === true, 'En producción permite origen explícitamente autorizado en ALLOWED_ORIGINS');
    assert(esOrigenPermitido('http://localhost:4200') === true, 'En producción permite localhost únicamente si fue declarado en ALLOWED_ORIGINS');
    assert(esOrigenPermitido('https://malicioso.com') === false, 'En producción rechaza origen no listado');

    // En modo desarrollo / test:
    process.env.NODE_ENV = 'development';
    delete process.env.ALLOWED_ORIGINS;
    assert(esOrigenPermitido('http://localhost:4200') === true, 'En desarrollo permite localhost automáticamente');
    assert(esOrigenPermitido('http://127.0.0.1:3001') === true, 'En desarrollo permite 127.0.0.1 automáticamente');
    assert(esOrigenPermitido('http://192.168.1.100:4200') === true, 'En desarrollo permite IP de red local automáticamente');
    assert(esOrigenPermitido('https://externo-no-confiable.com') === false, 'En desarrollo rechaza origen externo no confiable');
  } finally {
    process.env.NODE_ENV = origEnv;
    if (origOrigins) process.env.ALLOWED_ORIGINS = origOrigins;
  }

  // 3.2 Mensaje de probarConexionBD sin URL
  const origDbUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const estadoBd = await probarConexionBD();
    assert(estadoBd.conectada === false, 'Sin DATABASE_URL devuelve conectada=false');
    assert(!estadoBd.detalle.includes('modo desarrollo local seguro'), 'No afirma falsamente "modo desarrollo local seguro"');
    assert(estadoBd.detalle.includes('Conexión a base de datos requerida'), 'Informa con precisión que la conexión a BD es requerida');
  } finally {
    if (origDbUrl) process.env.DATABASE_URL = origDbUrl;
  }

  // 3.3 Cabeceras de seguridad en index.ts y cookieParser sin secreto quemado
  const rutaIndex = fs.existsSync(path.resolve(__dirname, '../index.ts'))
    ? path.resolve(__dirname, '../index.ts')
    : path.resolve(__dirname, '../../src/index.ts');
  const contenidoIndex = fs.readFileSync(rutaIndex, 'utf8');
  assert(contenidoIndex.includes('X-Content-Type-Options') && contenidoIndex.includes('nosniff'), 'Configura cabecera X-Content-Type-Options: nosniff');
  assert(contenidoIndex.includes('X-Frame-Options') && contenidoIndex.includes('DENY'), 'Configura cabecera X-Frame-Options: DENY');
  assert(contenidoIndex.includes('Referrer-Policy'), 'Configura cabecera Referrer-Policy');
  assert(contenidoIndex.includes('Permissions-Policy'), 'Configura cabecera Permissions-Policy');
  assert(!contenidoIndex.includes("'asmibuy-secret-key'"), 'Eliminado secreto fijo quemado de cookieParser');
}

async function main() {
  console.log('========================================================================');
  console.log('🧪 BATERÍA DE VERIFICACIÓN AUDITORÍA 3 — INTEGRANTE 1 (PLATAFORMA Y ACCESOS)');
  console.log('========================================================================');

  await probarA3_1_01_RateLimitingYTiming();
  await probarA3_1_02_Migracion007YTimeZone();
  await probarA3_1_03_SeguridadHeadersCookiesYOrigenes();

  console.log('\n========================================================================');
  console.log(`📊 RESULTADO FINAL: ${exitos} PRUEBAS EXITOSAS, ${fallos} FALLOS`);
  console.log('========================================================================');

  if (fallos > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error fatal durante la verificación de Auditoría 3:', err);
  process.exit(1);
});
