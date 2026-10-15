/* Requiere builds, fixtures verificar-auditoria2-w4 y Playwright externo o instalado. */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { Pool } = require('pg');
const express = require('express');

async function run() {
  assert.ok(!process.env.DATABASE_URL, 'No usar DATABASE_URL operativa');
  const url = new URL(process.env.TEST_DATABASE_URL || 'http://invalido');
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol) &&
    ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && /^\/asmibuy_test_[a-z0-9_]+$/.test(url.pathname), 'TEST_DATABASE_URL local desechable obligatoria');
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const raiz = path.resolve(__dirname, '../../..');
  const pool = new Pool({ connectionString: url.href, ssl: false });
  const api = spawn(process.execPath, [path.join(raiz, 'app/backend/dist/index.js')], {
    cwd: raiz, env: { ...process.env, DATABASE_URL: url.href, DB_SSL: 'false', PORT: '3304', NODE_ENV: 'test', BUSINESS_TIME_ZONE: 'America/Mexico_City' },
    stdio: 'ignore'
  });
  const app = express();
  app.use('/api', (req, res) => {
    const upstream = http.request({ hostname: '127.0.0.1', port: 3304, path: req.originalUrl, method: req.method, headers: req.headers }, response => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    });
    upstream.on('error', () => res.status(502).end());
    req.pipe(upstream);
  });
  const dist = path.join(raiz, 'app/frontend/dist/frontend/browser');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  const server = await new Promise(resolve => { const s = app.listen(4304, '127.0.0.1', () => resolve(s)); });
  let browser;
  let pruebas = 0;
  const pass = descripcion => console.log(`PASS ${++pruebas}: ${descripcion}`);
  try {
    for (let i = 0; i < 80; i++) {
      try { if ((await fetch('http://127.0.0.1:3304/api/v1/health')).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const usuarios = (await pool.query("SELECT id, correo, perfil FROM usuarios WHERE nombre IN ('Caja A A2','Caja B A2') ORDER BY id DESC LIMIT 2")).rows;
    const a = usuarios.find(u => u.perfil === 'ADMINISTRADOR');
    const b = usuarios.find(u => u.perfil === 'TRABAJADOR');
    assert.ok(a && b, 'Ejecute antes los fixtures de PostgreSQL');
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const origen = 'http://127.0.0.1:4304';
    const login = async usuario => {
      await page.goto(`${origen}/login`);
      await page.getByLabel('Correo Electrónico').fill(usuario.correo);
      await page.locator('#password').fill('Solo-Pruebas-W4-2026!');
      await page.getByRole('button', { name: /Entrar al Sistema/ }).click();
      await page.waitForURL('**/venta');
      await page.getByRole('button', { name: /^Agregar Platillo A2/ }).first().waitFor();
    };
    const logout = async () => {
      await page.locator('button[title="Cerrar Sesión"]:visible').first().click();
      await page.waitForURL('**/login');
    };
    const claveStorage = `asmibuy_venta_pendiente:${a.id}`;
    const pendiente = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), claveStorage);
    const contar = async clave => Number((await pool.query('SELECT count(*) AS n FROM ordenes WHERE clave_idempotencia=$1', [clave])).rows[0].n);
    const agregar = async () => {
      await page.getByRole('button', { name: /^Agregar Platillo A2/ }).first().click();
      await page.locator('.btn-confirmar-venta:enabled').waitFor();
    };
    const evidencia = path.join(raiz, 'docs/auditorias/evidencias/w4-a2');
    fs.mkdirSync(evidencia, { recursive: true });
    await login(a);
    await agregar();
    let enviada;
    const perderRespuesta = async route => {
      enviada = route.request().postDataJSON();
      const respuesta = await route.fetch();
      assert.equal(respuesta.status(), 200, 'El servidor debe confirmar antes de perder la respuesta');
      await route.abort('connectionfailed');
    };
    await page.route('**/api/v1/ventas/confirmar', perderRespuesta);
    await page.locator('.btn-confirmar-venta').click();
    await page.getByText(/Resultado incierto/).waitFor();
    assert.equal(await contar(enviada.claveIdempotencia), 1);
    assert.deepEqual(await pendiente(), enviada);
    pass('Respuesta perdida DESPUÉS de COMMIT: una orden real y solicitud íntegra conservada');
    assert.ok(await page.getByRole('button', { name: /^Agregar Platillo A2/ }).first().isDisabled());
    assert.equal(await page.getByRole('button', { name: 'Descartar', exact: true }).count(), 0);
    pass('No se puede descartar ni iniciar otra venta con resultado incierto');
    await page.screenshot({ path: path.join(evidencia, '01-respuesta-incierta-pc.png'), fullPage: true });
    await page.locator('a[href="/historial"]:visible').first().click();
    await page.waitForURL('**/historial');
    await page.locator('a[href="/venta"]:visible').first().click();
    await page.getByText('Transacción en vuelo detectada').waitFor();
    assert.deepEqual(await pendiente(), enviada);
    pass('Navegación Historial/Venta conserva identidad y bloqueo');
    await page.reload();
    await page.getByText('Transacción en vuelo detectada').waitFor();
    assert.deepEqual(await pendiente(), enviada);
    pass('Recarga conserva la misma clave y solicitud');
    await logout();
    await login(b);
    assert.equal(await page.getByText('Transacción en vuelo detectada').count(), 0);
    const acceso = await context.request.get(`${origen}/api/v1/ventas/recuperar/${enviada.claveIdempotencia}`);
    assert.equal(acceso.status(), 403);
    pass('Cambio de usuario no muestra el pendiente ajeno; API rechaza recuperación ajena');
    await logout();
    await login(a);
    await page.getByText('Transacción en vuelo detectada').waitFor();
    assert.deepEqual(await pendiente(), enviada);
    pass('Cerrar sesión y volver al usuario original restaura el pendiente');

    const noEncontrada = route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ encontrada: false, orden: null }) });
    await page.route('**/api/v1/ventas/recuperar/*', noEncontrada);
    await page.getByRole('button', { name: /Verificar Estado/ }).click();
    await page.getByText(/Todavía no se encontró/).waitFor();
    assert.deepEqual(await pendiente(), enviada);
    pass('Consulta aún sin resultado no borra la identidad ni desbloquea otra venta');
    await page.unroute('**/api/v1/ventas/recuperar/*', noEncontrada);
    await page.unroute('**/api/v1/ventas/confirmar', perderRespuesta);
    let reintentada;
    const observar = async route => { reintentada = route.request().postDataJSON(); await route.continue(); };
    await page.route('**/api/v1/ventas/confirmar', observar);
    await page.getByRole('button', { name: 'Reintentar misma operación' }).click();
    await page.getByText(/confirmada con éxito/).waitFor();
    assert.deepEqual(reintentada, enviada);
    assert.equal(await contar(enviada.claveIdempotencia), 1);
    assert.equal(await pendiente(), null);
    pass('Reintento reutiliza el payload exacto y recupera la misma orden sin duplicar consumo');
    await page.screenshot({ path: path.join(evidencia, '02-recuperada-pc.png'), fullPage: true });
    await page.unroute('**/api/v1/ventas/confirmar', observar);
    await page.getByRole('button', { name: /Nueva Venta/ }).click();
    await agregar();
    const perderSolicitud = async route => { enviada = route.request().postDataJSON(); await route.abort('connectionfailed'); };
    await page.route('**/api/v1/ventas/confirmar', perderSolicitud);
    await page.locator('.btn-confirmar-venta').click();
    await page.getByText(/Resultado incierto/).waitFor();
    assert.equal(await contar(enviada.claveIdempotencia), 0);
    await page.reload();
    await page.getByText('Transacción en vuelo detectada').waitFor();
    await page.getByRole('button', { name: /Verificar Estado/ }).click();
    await page.getByText(/Todavía no se encontró/).waitFor();
    assert.deepEqual(await pendiente(), enviada);
    pass('Solicitud perdida ANTES de llegar al servidor: consulta negativa conserva pendiente tras recarga');
    await page.setViewportSize({ width: 360, height: 800 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(evidencia, '03-pendiente-360px-edge-pc.png'), fullPage: true });
    pass('Edge de PC a 360 px: controles pendientes sin desbordamiento (no equivale a Android/iPhone)');
    await page.unroute('**/api/v1/ventas/confirmar', perderSolicitud);
    await page.getByRole('button', { name: 'Reintentar misma operación' }).click();
    await page.getByText(/confirmada con éxito/).waitFor();
    assert.equal(await contar(enviada.claveIdempotencia), 1);
    pass('Reintento de solicitud no recibida confirma una sola venta con la identidad original');

    // Compatibilidad segura: la versión auditada guardaba únicamente la clave en sessionStorage común.
    await page.evaluate(clave => sessionStorage.setItem('asmibuy_transaccion_vuelo', clave), enviada.claveIdempotencia);
    await page.reload();
    await page.getByText('Transacción en vuelo detectada').waitFor();
    assert.ok(await page.getByRole('button', { name: 'Reintentar misma operación' }).isDisabled());
    pass('Pendiente legado sin payload no se descarta ni se reenvía inventando una solicitud');
    await page.getByRole('button', { name: /Verificar Estado/ }).click();
    await page.getByText(/Venta previa .* recuperada con éxito/).waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('asmibuy_transaccion_vuelo')), null);
    assert.equal(await contar(enviada.claveIdempotencia), 1);
    pass('Consulta real recupera la orden propia y solo entonces elimina la clave legada');
    await page.evaluate(() => sessionStorage.setItem('asmibuy_transaccion_vuelo', 'legado-no-recibido-a2'));
    await page.reload();
    await page.getByText('Transacción en vuelo detectada').waitFor();
    await page.getByRole('button', { name: /Verificar Estado/ }).click();
    await page.getByText(/Todavía no se encontró la venta antigua/).waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('asmibuy_transaccion_vuelo')), 'legado-no-recibido-a2');
    pass('Legado no encontrado conserva identidad y bloqueo para revisión manual');
    // Limpiar únicamente el fixture ficticio creado por esta prueba, no una operación real.
    await page.evaluate(() => sessionStorage.removeItem('asmibuy_transaccion_vuelo'));
    await page.reload();
    await agregar();
    let enviosInseguros = 0;
    const observarInseguro = async route => { enviosInseguros++; await route.abort(); };
    await page.route('**/api/v1/ventas/confirmar', observarInseguro);
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Prueba de almacenamiento bloqueado', 'SecurityError'); }; });
    await page.locator('.btn-confirmar-venta').click();
    await page.getByText(/No se puede conservar la operación pendiente/).waitFor();
    assert.equal(enviosInseguros, 0);
    pass('Almacenamiento no disponible: no envía una confirmación irrecuperable');
    const meta = { fecha: new Date().toISOString(), navegador: `Microsoft Edge ${browser.version()}`, plataforma: process.platform,
      viewport: ['1280x900', '360x800 (emulación de tamaño en PC)'], pruebas, resultado: 'PASS',
      backend: 'API Express real + PostgreSQL 18.4 aislado; pérdida de respuesta por route.abort después de route.fetch 200',
      pendientes: ['Chrome Android real', 'Safari iPhone real', 'revisión humana 3/2/1', 'Supabase'] };
    fs.writeFileSync(path.join(evidencia, 'resultado.json'), JSON.stringify(meta, null, 2) + '\n');
    console.log(`RESULTADO navegador: ${pruebas}/${pruebas}; ${meta.navegador}`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    api.kill();
    await pool.end();
  }
}
run().catch(e => { console.error(`FAIL navegador: ${e.name}: ${e.message}`); process.exitCode = 1; });
