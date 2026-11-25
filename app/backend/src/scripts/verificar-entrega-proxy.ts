/**
 * =========================================================================
 * VERIFICACIÓN A-ENT-02 — INTEGRANTE 1 (PLATAFORMA Y ACCESOS)
 * Login detrás de proxy: TRUST_PROXY y umbral por IP mayor que por IP + correo.
 * No requiere base de datos.
 * Uso: npm run build:backend && node app/backend/dist/scripts/verificar-entrega-proxy.js
 * =========================================================================
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { AddressInfo } from 'net';
import { interpretarTrustProxy } from '../config/proxy';
import { LoginRateLimiter } from '../services/login-rate-limiter';

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

function probarInterpretacion() {
  console.log('\n⚙️  1. Interpretación de TRUST_PROXY');
  assert(interpretarTrustProxy(undefined) === false, 'Sin variable → desactivado');
  assert(interpretarTrustProxy('') === false, 'Vacío → desactivado');
  assert(interpretarTrustProxy('false') === false && interpretarTrustProxy('0') === false, '"false" y "0" → desactivado');
  assert(interpretarTrustProxy('1') === 1 && interpretarTrustProxy(' 2 ') === 2, 'Número → cantidad de proxies de confianza');
  assert(interpretarTrustProxy('true') === true, '"true" → confía en cualquier origen (se advierte en el arranque)');
  assert(interpretarTrustProxy('loopback, 10.0.0.0/8') === 'loopback, 10.0.0.0/8', 'Lista de subredes → se pasa tal cual a Express');
}

async function ipObservada(trust: ReturnType<typeof interpretarTrustProxy>, xff?: string): Promise<string> {
  const app = express();
  if (trust !== false) app.set('trust proxy', trust);
  app.get('/ip', (req, res) => res.json({ ip: req.ip }));
  const servidor = app.listen(0, '127.0.0.1');
  await new Promise((r) => servidor.once('listening', r));
  try {
    const { port } = servidor.address() as AddressInfo;
    const r = await fetch(`http://127.0.0.1:${port}/ip`, { headers: xff ? { 'X-Forwarded-For': xff } : {} });
    return ((await r.json()) as { ip: string }).ip;
  } finally {
    servidor.close();
  }
}

async function probarIpReal() {
  console.log('\n🌐 2. IP del cliente vista por Express');
  const sinProxyA = await ipObservada(false, '203.0.113.10');
  const sinProxyB = await ipObservada(false, '203.0.113.20');
  assert(sinProxyA === sinProxyB && !sinProxyA.includes('203.0.113'), `Desactivado: ignora X-Forwarded-For (ambas = ${sinProxyA})`);

  const conProxyA = await ipObservada(1, '203.0.113.10');
  const conProxyB = await ipObservada(1, '203.0.113.20');
  assert(conProxyA === '203.0.113.10' && conProxyB === '203.0.113.20', 'TRUST_PROXY=1: cada caja conserva su IP real');

  const falsificada = await ipObservada(1, '198.51.100.99, 203.0.113.30');
  assert(falsificada === '203.0.113.30', 'TRUST_PROXY=1: sólo se confía en el último salto (no se puede inyectar una IP a la izquierda)');
}

function probarLimitador() {
  console.log('\n🔒 3. Límite de intentos con IP compartida');
  const umbralCorreo = LoginRateLimiter.MAX_INTENTOS_SIN_BLOQUEO;
  const umbralIp = LoginRateLimiter.MAX_INTENTOS_POR_IP;
  assert(umbralIp > umbralCorreo, `Umbral por IP (${umbralIp}) mayor que por IP + correo (${umbralCorreo})`);

  // Dos personas en la misma IP de la sucursal
  LoginRateLimiter.resetear();
  const ipSucursal = '203.0.113.50';
  let ultimo = { bloqueado: false, reintentarEnSegundos: 0 };
  for (let i = 0; i < umbralCorreo; i++) ultimo = LoginRateLimiter.registrarFallo(ipSucursal, 'cajera.a@asmibuy.test');
  assert(ultimo.bloqueado && ultimo.reintentarEnSegundos > 0, `${umbralCorreo} fallos del mismo correo bloquean ese correo (Retry-After ${ultimo.reintentarEnSegundos} s)`);
  assert(LoginRateLimiter.verificarBloqueo(ipSucursal, 'cajera.a@asmibuy.test').bloqueado, 'El correo bloqueado sigue bloqueado al reintentar');
  assert(!LoginRateLimiter.verificarBloqueo(ipSucursal, 'cajero.b@asmibuy.test').bloqueado, 'Otra persona desde la MISMA IP no queda bloqueada');

  // Dos personas en IP distintas (TRUST_PROXY activo)
  LoginRateLimiter.resetear();
  for (let i = 0; i < umbralCorreo; i++) LoginRateLimiter.registrarFallo('203.0.113.61', 'cajera.a@asmibuy.test');
  assert(!LoginRateLimiter.verificarBloqueo('203.0.113.62', 'cajero.b@asmibuy.test').bloqueado, 'Con IP distintas, los fallos de una caja no afectan a otra');

  // Fuerza bruta probando muchos correos desde una IP
  LoginRateLimiter.resetear();
  const ipAtacante = '198.51.100.77';
  let alcanzado = false;
  for (let i = 0; i < umbralIp; i++) alcanzado = LoginRateLimiter.registrarFallo(ipAtacante, `prueba${i}@asmibuy.test`).bloqueado;
  assert(alcanzado, `${umbralIp} fallos con correos distintos desde una IP bloquean esa IP`);
  assert(LoginRateLimiter.verificarBloqueo(ipAtacante, 'otro@asmibuy.test').bloqueado, 'La IP bloqueada no puede probar un correo nuevo');
  LoginRateLimiter.resetear();
}

function probarDocumentacion() {
  console.log('\n📄 4. Configuración documentada');
  const raiz = path.resolve(__dirname, '../../../..');
  const leer = (p: string) => fs.readFileSync(path.join(raiz, p), 'utf8');
  assert(/TRUST_PROXY=/.test(leer('.env.example')), '.env.example documenta TRUST_PROXY');
  assert(/LOGIN_MAX_INTENTOS_IP=/.test(leer('.env.example')), '.env.example documenta LOGIN_MAX_INTENTOS_IP');
  assert(/TRUST_PROXY/.test(leer('README.md')), 'README.md explica TRUST_PROXY');
  assert(/interpretarTrustProxy\(process\.env\.TRUST_PROXY\)/.test(leer('app/backend/src/index.ts')), 'index.ts aplica TRUST_PROXY antes de registrar rutas');
}

async function main() {
  console.log('========================================================================');
  console.log('🧪 VERIFICACIÓN A-ENT-02 — LOGIN DETRÁS DE PROXY (INTEGRANTE 1)');
  console.log('========================================================================');
  probarInterpretacion();
  await probarIpReal();
  probarLimitador();
  probarDocumentacion();
  console.log('\n========================================================================');
  console.log(`📊 RESULTADO FINAL: ${exitos} PRUEBAS EXITOSAS, ${fallos} FALLOS`);
  console.log('========================================================================');
  if (fallos > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Error fatal durante la verificación A-ENT-02:', err);
  process.exit(1);
});
