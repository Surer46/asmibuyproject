// Fase C: CW-17 y CW-18 en Edge PC (360 px, escritorio y zoom 200 %) + QA-L-01
import { chromium, AxeBuilder, EDGE, ADMIN, T1, BASE, abrir, login, ir, tab, captura, mensajes, check, guardarRegistro, esperar, sinDesbordamiento } from './lib.mjs';

const browser = await chromium.launch({ headless: true, executablePath: EDGE });
const version = browser.version();
const etiquetasAxe = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function revisarPantalla(page, nombre) {
  await esperar(700);
  const desborda = !(await sinDesbordamiento(page));
  const axe = await new AxeBuilder({ page }).withTags(etiquetasAxe).analyze();
  const pequeños = page.vista === 'movil' ? await page.evaluate(() => [...document.querySelectorAll('a[href], button, input, select, textarea')]
    .filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[aria-hidden="true"]'))
    .map(e => { const r = e.getBoundingClientRect(); return { t: (e.getAttribute('aria-label') || e.innerText || e.getAttribute('placeholder') || e.tagName).trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter(x => x.w < 44 || x.h < 44)) : [];
  await captura(page, `cw17-${nombre}`);
  return { desborda, axe: axe.violations.map(v => `${v.id}(${v.nodes.length})`), pequeños };
}

for (const vista of ['movil', 'escritorio']) {
  // --- Trabajador: login, venta con promoción, comprobante, historial, avisos ---
  const p = await abrir(browser, vista);
  await p.goto(BASE + '/login');
  const rLogin = await revisarPantalla(p, 'login');
  // QA-L-01: error de login a 360 px
  await p.locator('#correo').fill(T1.correo); await p.locator('#password').fill('Incorrecta-000');
  await p.locator('button[type="submit"]').click();
  await p.locator('[role="alert"]').waitFor({ timeout: 5000 });
  const botonVisible = await p.locator('button[type="submit"]').evaluate(b => { const r = b.getBoundingClientRect(); return r.bottom <= window.innerHeight && r.top >= 0; });
  await captura(p, 'qa-l-01-login-error', false);
  if (vista === 'movil') check('QA-L-01', vista, botonVisible, `A 360×780 con el error visible, el botón «Entrar al Sistema» ${botonVisible ? 'queda dentro de la pantalla sin desplazarse' : 'queda fuera de la pantalla (requiere desplazamiento)'}`);
  await login(p, T1);
  const rVenta = await revisarPantalla(p, 'venta');
  for (let i = 0; i < 5; i++) await p.locator('button[aria-label="Agregar Refresco al carrito"]').click();
  await esperar(1500);
  const rCarrito = await revisarPantalla(p, 'venta-carrito-promocion');
  await p.locator('button:has-text("Confirmar Venta")').click();
  await p.locator('.folio-badge strong').waitFor({ timeout: 10000 });
  const rComprobante = await revisarPantalla(p, 'comprobante');
  await p.locator('button:has-text("Nueva Venta")').click(); await esperar(400);
  await ir(p, 'historial'); const rHistorial = await revisarPantalla(p, 'historial');
  await ir(p, 'avisos'); const rAvisos = await revisarPantalla(p, 'avisos');
  // Botón Atrás del navegador
  await p.goBack(); await esperar(800); const tras1 = new URL(p.url()).pathname;
  await p.goBack(); await esperar(800); const tras2 = new URL(p.url()).pathname;
  check('CW-17', vista, tras1 === '/historial' && tras2 === '/venta', `Botón Atrás: avisos → ${tras1} → ${tras2}`);
  const gestionVisible = await p.locator('a[href="/gestion"]:visible').count();
  check('CW-17', vista, gestionVisible === 0, `Trabajador: enlaces a Gestión visibles = ${gestionVisible}`);
  // Fuentes
  const fuentes = await p.evaluate(async () => { await document.fonts.ready; return { roboto: document.fonts.check('16px Roboto'), simbolos: document.fonts.check('24px "Material Symbols Rounded"'), cuerpo: getComputedStyle(document.body).fontFamily }; });
  await p.context().close();

  // --- Administrador: gestión ---
  const a = await abrir(browser, vista);
  await login(a, ADMIN);
  await ir(a, 'gestion');
  const rGestion = {};
  for (const t of ['Insumos', 'Platillos', 'Movimientos', 'Promociones']) { await tab(a, t); rGestion[t] = await revisarPantalla(a, 'gestion-' + t.toLowerCase()); }
  await tab(a, 'Insumos');
  await a.locator('button:has-text("Nuevo Insumo")').click();
  await a.locator('[role="dialog"] button[type="submit"]').click();
  await esperar(800);
  const rDialogo = await revisarPantalla(a, 'gestion-dialogo-validacion');
  await a.keyboard.press('Escape');
  await a.context().close();

  const todas = { login: rLogin, venta: rVenta, carrito: rCarrito, comprobante: rComprobante, historial: rHistorial, avisos: rAvisos, ...Object.fromEntries(Object.entries(rGestion).map(([k, v]) => ['gestion-' + k, v])), dialogo: rDialogo };
  const desbordan = Object.entries(todas).filter(([, v]) => v.desborda).map(([k]) => k);
  check('CW-17', vista, desbordan.length === 0, `Recorrido completo (${Object.keys(todas).length} pantallas): desbordamiento horizontal en [${desbordan.join(', ') || 'ninguna'}]`);
  const conAxe = Object.entries(todas).filter(([, v]) => v.axe.length).map(([k, v]) => `${k}: ${v.axe.join(' ')}`);
  check('CW-18', vista, conAxe.length === 0, `axe (WCAG 2.x A/AA) en ${Object.keys(todas).length} pantallas: ${conAxe.join('; ') || 'sin violaciones'}`);
  check('CW-18', vista, fuentes.roboto && fuentes.simbolos, `Fuentes cargadas: Roboto=${fuentes.roboto}, Material Symbols Rounded=${fuentes.simbolos}; body: ${fuentes.cuerpo}`);
  if (vista === 'movil') {
    const peq = Object.entries(todas).flatMap(([k, v]) => v.pequeños.map(x => `${k}:"${x.t}" ${x.w}×${x.h}`));
    const unicos = [...new Set(peq.map(x => x.split(':').slice(1).join(':')))];
    check('CW-18', vista, unicos.length === 0, `Objetivos táctiles < 44×44 px a 360 px: ${unicos.length ? unicos.join('; ') : 'ninguno'}`);
  }
}

// --- Teclado y foco visible (escritorio) ---
{
  const p = await abrir(browser, 'escritorio');
  await p.goto(BASE + '/login');
  const recorrido = [];
  for (let i = 0; i < 4; i++) {
    await p.keyboard.press('Tab');
    recorrido.push(await p.evaluate(() => { const e = document.activeElement; const cs = getComputedStyle(e); return { el: (e.getAttribute('aria-label') || e.id || e.innerText || e.tagName).trim().slice(0, 25), foco: cs.outlineStyle !== 'none' || (cs.boxShadow !== 'none' && !cs.boxShadow.startsWith('rgba(0, 0, 0, 0)')) || cs.borderColor !== 'rgb(229, 231, 235)' }; }));
  }
  await p.locator('#correo').fill(T1.correo); await p.locator('#password').fill(T1.pass); await p.keyboard.press('Enter');
  await p.waitForURL('**/venta');
  await captura(p, 'cw18-teclado-login-enter', false);
  check('CW-18', 'escritorio', recorrido.every(r => r.foco), `Tab en login: ${recorrido.map(r => `${r.el}${r.foco ? ' (foco visible)' : ' (SIN foco visible)'}`).join(' → ')}; Enter envía el formulario`);
  await p.context().close();
}

// --- Zoom 200 % (escritorio 1280×800 con zoom del navegador al 200 % ≡ 640×400 CSS px, escala 2) ---
{
  const ctx = await browser.newContext({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 2, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  const p = await ctx.newPage(); p.vista = 'zoom200';
  await login(p, ADMIN);
  const res = {};
  for (const r of ['venta', 'historial', 'avisos', 'gestion']) { await ir(p, r); await esperar(600); res[r] = await sinDesbordamiento(p); await captura(p, 'cw18-zoom200-' + r); }
  const mal = Object.entries(res).filter(([, v]) => !v).map(([k]) => k);
  check('CW-18', 'zoom200', mal.length === 0, `Zoom 200 % (equivalente 640×400 CSS px, escala 2): desbordamiento horizontal en [${mal.join(', ') || 'ninguna'}]`);
  await ctx.close();
}

check('ENTORNO', '-', true, `Microsoft Edge ${version} (Chromium) controlado con Playwright; Windows 11; vistas 360×780 y 1280×800`);
guardarRegistro('resultados-fase-c.json');
await browser.close();
