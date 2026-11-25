import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const KIT = 'C:/Users/santi/Documents/revision-interfaces-v2.2';
const require = createRequire(KIT + '/package.json');
export const { chromium } = require('playwright');
export const AxeBuilder = require('@axe-core/playwright').default;

export const BASE = 'http://localhost:4200';
export const API = 'http://localhost:3001/api/v1';
export const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
export const EVID = process.env.QA_EVID;
export const VISTAS = { movil: { width: 360, height: 780 }, escritorio: { width: 1280, height: 800 } };

const lineas = fs.readFileSync('C:/Users/santi/Documents/asmibuy-cuentas-qa-visual.txt', 'utf8').split(/\r?\n/);
const cuenta = correo => { const l = lineas.find(x => x.includes(' ' + correo + ' ')).trim().split(/\s+/); return { correo: l[1], pass: l[2] }; };
export const ADMIN = cuenta('admin.qa@asmibuy.test');
export const T1 = cuenta('trabajador1.qa@asmibuy.test');
export const T2 = cuenta('trabajador2.qa@asmibuy.test');

// Consulta a la base QA (solo lectura) vía psql en el contenedor
export function sql(q) {
  const out = execFileSync('docker', ['exec', 'asmibuy-pg-local', 'psql', '-U', 'postgres', '-d', 'asmibuy_test_qa_visual', '-tA', '-F', '|', '-c', q], { encoding: 'utf8' });
  return out.trim().split('\n').filter(Boolean).map(l => l.split('|'));
}
export const saldo = nombre => {
  const r = sql(`select coalesce(sum(m.cantidad),0) from ingredientes i left join movimientos_inventario m on m.ingrediente_id=i.id where i.nombre='${nombre}' group by i.id`);
  return r.length ? Number(r[0][0]) : null;
};

export const registro = [];
export function check(cw, vista, ok, detalle) {
  registro.push({ cw, vista, ok: !!ok, detalle });
  console.log(`${ok ? 'PASA ' : 'FALLA'} ${cw} [${vista}] ${detalle}`);
}
export function guardarRegistro(nombre) {
  fs.writeFileSync(path.join(EVID, nombre), JSON.stringify(registro, null, 2));
}

export async function abrir(browser, vista = 'escritorio') {
  const ctx = await browser.newContext({ viewport: VISTAS[vista], locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  const page = await ctx.newPage();
  page.vista = vista;
  return page;
}
export async function login(page, c) {
  await page.goto(BASE + '/login');
  await page.locator('#correo').fill(c.correo);
  await page.locator('#password').fill(c.pass);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/venta', { timeout: 10000 });
  await page.locator('text=Catálogo de Platillos').waitFor();
}
export async function ir(page, ruta) {
  await page.locator(`a[href="/${ruta}"]:visible`).first().click();
  await page.waitForURL('**/' + ruta);
  await page.waitForTimeout(600);
}
export async function tab(page, nombre) {
  await page.locator(`.segmented-control button:has-text("${nombre}")`).click();
  await page.waitForTimeout(500);
}
export async function captura(page, nombre, completa = true) {
  const f = `${nombre}-${page.vista}.png`;
  await page.screenshot({ path: path.join(EVID, f), fullPage: completa });
  return f;
}
// Selecciona la opción cuyo texto contiene `texto`
export async function elegir(page, selector, texto) {
  const valor = await page.locator(selector).evaluate((s, t) => {
    const o = [...s.options].find(x => x.textContent.includes(t));
    return o ? o.value : null;
  }, texto);
  if (valor === null) throw Error(`Opción "${texto}" no encontrada en ${selector}`);
  await page.locator(selector).selectOption(valor);
}
export async function mensajes(page) {
  return (await page.locator('.notificacion, [role="alert"], .notif-exito, .notif-error').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
export async function sinDesbordamiento(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}
export const esperar = ms => new Promise(r => setTimeout(r, ms));
