// Fase A: datos de QA desde la interfaz + CW-03, CW-04, CW-08, CW-09 (escritorio y 360 px)
import { chromium, EDGE, ADMIN, abrir, login, ir, tab, captura, elegir, mensajes, sql, saldo, check, guardarRegistro, esperar, sinDesbordamiento } from './lib.mjs';

const browser = await chromium.launch({ headless: true, executablePath: EDGE });
const page = await abrir(browser, 'escritorio');
await login(page, ADMIN);
await ir(page, 'gestion');

async function nuevoInsumo(nombre, unidad, minimo) {
  await tab(page, 'Insumos');
  await page.locator('button:has-text("Nuevo Insumo")').click();
  await page.locator('#ing-nombre').fill(nombre);
  await page.locator('#ing-unidad').selectOption(unidad);
  await page.locator('#ing-minimo').fill(String(minimo));
  await page.locator('button[type="submit"]:has-text("Guardar Insumo")').click();
  await page.locator('#ing-nombre').waitFor({ state: 'detached', timeout: 8000 });
  await esperar(500);
}
async function entrada(nombre, cantidad, motivo) {
  await tab(page, 'Movimientos');
  await page.locator('.btn-group-acciones button:has-text("Entrada")').click();
  await elegir(page, '#ent-ing', nombre + ' (');
  await page.locator('#ent-cant').fill(String(cantidad));
  await page.locator('#ent-mot').fill(motivo);
  await page.locator('button[type="submit"]:visible').click();
  await page.locator('#ent-cant').waitFor({ state: 'detached', timeout: 8000 });
  await esperar(500);
}
async function ajuste(nombre, cantidad, motivo, { esperarCierre = true } = {}) {
  await tab(page, 'Movimientos');
  await page.locator('.btn-group-acciones button:has-text("Ajuste")').click();
  await elegir(page, '#aj-ing', nombre + ' (');
  await page.locator('#aj-cant').fill(String(cantidad));
  await page.locator('#aj-mot').fill(motivo);
  await page.locator('button[type="submit"]:visible').click();
  if (esperarCierre) { await page.locator('#aj-cant').waitFor({ state: 'detached', timeout: 8000 }); await esperar(500); }
  else await esperar(1500);
}
async function nuevoPlatillo(nombre, precio, receta) {
  await tab(page, 'Platillos');
  await page.locator('button:has-text("Nuevo Platillo")').click();
  await page.locator('#plat-nombre').fill(nombre);
  await page.locator('#plat-precio').fill(String(precio));
  for (let i = 0; i < receta.length; i++) {
    if (i > 0) await page.locator('button:has-text("Agregar Insumo")').click();
    const sel = page.locator('.receta-fila select').nth(i);
    const v = await sel.evaluate((s, t) => [...s.options].find(o => o.textContent.includes(t))?.value, receta[i][0] + ' (');
    await sel.selectOption(v);
    await page.locator('.receta-fila input[type="number"]').nth(i).fill(String(receta[i][1]));
  }
  await page.locator('button[type="submit"]:has-text("Guardar Platillo")').click();
  await page.locator('#plat-nombre').waitFor({ state: 'detached', timeout: 8000 });
  await esperar(500);
}

// ---------- Insumos (ejemplos del spec + insumos para promociones) ----------
const insumos = [['Pan', 'pieza', 20], ['Carne', 'g', 2000], ['Queso', 'pieza', 5], ['Lechuga', 'g', 100],
  ['Refresco lata', 'pieza', 5], ['Papa', 'g', 500], ['Agua botella', 'pieza', 5], ['Salchicha', 'pieza', 5], ['Tortilla', 'pieza', 10]];
const yaHay = sql(`select count(*) from ingredientes`)[0][0] !== '0';
if (!yaHay) for (const [n, u, m] of insumos) await nuevoInsumo(n, u, m);
const filas = sql(`select nombre, unidad, minimo from ingredientes order by id`);
check('DATOS', 'escritorio', filas.length === insumos.length, `insumos creados desde la UI: ${filas.map(f => f[0] + ' ' + f[1] + ' min ' + Number(f[2])).join(', ')}`);

if (!yaHay) {
// ---------- CW-04: stock inicial, entrada, ajuste ----------
const iniciales = { 'Pan': 30, 'Carne': 4500, 'Queso': 30, 'Lechuga': 500, 'Refresco lata': 40, 'Papa': 3000, 'Agua botella': 20, 'Salchicha': 30, 'Tortilla': 50 };
for (const [n, c] of Object.entries(iniciales)) await entrada(n, c, 'Stock inicial QA visual');
await entrada('Pan', 10, 'Compra panadería QA');
await ajuste('Pan', -5, 'Merma por caducidad QA');
check('CW-04', 'escritorio', saldo('Pan') === 35, `Pan: inicial 30 + entrada 10 - ajuste 5 = ${saldo('Pan')} (esperado 35)`);
await ajuste('Pan', -1000, 'Ajuste excesivo QA', { esperarCierre: false });
const errAjuste = await mensajes(page);
await captura(page, 'cw04-ajuste-mayor-rechazado', false);
check('CW-04', 'escritorio', saldo('Pan') === 35 && errAjuste.some(m => /negativ|insuficiente|existencia|mayor/i.test(m)), `Ajuste de -1000 rechazado: "${errAjuste.join(' | ')}"; saldo sigue en ${saldo('Pan')}`);
await page.locator('button:has-text("Cancelar"):visible').click();
await esperar(400);
const mov = sql(`select m.tipo, m.cantidad, m.motivo, u.correo from movimientos_inventario m join ingredientes i on i.id=m.ingrediente_id join usuarios u on u.id=m.usuario_id where i.nombre='Pan' order by m.id`);
check('CW-04', 'escritorio', mov.length === 3 && mov.every(r => r[2] && r[3] === ADMIN.correo), `Movimientos de Pan con autor y motivo: ${mov.map(r => `${r[0]} ${Number(r[1])} "${r[2]}" por ${r[3]}`).join('; ')}`);
const descuadre = sql(`select count(*) from ingredientes i where (select coalesce(sum(cantidad),0) from movimientos_inventario where ingrediente_id=i.id) < 0`);
check('CW-04', 'escritorio', descuadre[0][0] === '0', 'Ningún saldo negativo; el saldo de la UI se calcula como suma de movimientos');
await tab(page, 'Movimientos');
await captura(page, 'cw04-kardex-movimientos');
}

// ---------- CW-03: receta no consume; receta inválida no se vende ----------
const antes = Object.fromEntries(['Pan', 'Carne', 'Queso', 'Lechuga'].map(n => [n, saldo(n)]));
const hayPlatillos = sql(`select count(*) from platillos`)[0][0] !== '0';
if (!hayPlatillos) {
  await nuevoPlatillo('Hamburguesa', 100, [['Pan', 1], ['Carne', 150], ['Queso', 1]]);
  await nuevoPlatillo('Ensalada', 100, [['Lechuga', 200]]);
}
const despues = Object.fromEntries(Object.keys(antes).map(n => [n, saldo(n)]));
check('CW-03', 'escritorio', JSON.stringify(antes) === JSON.stringify(despues), `Guardar recetas no cambia saldos: ${JSON.stringify(despues)}`);
await tab(page, 'Platillos');
await captura(page, 'cw03-platillos-con-receta');
await ir(page, 'venta');
const vendiblesAntes = await page.locator('.platillos-grid button[aria-label^="Agregar "]').evaluateAll(b => b.map(x => x.getAttribute('aria-label')));
await ir(page, 'gestion');

// (a) Platillo sin ingredientes: se rechaza
await tab(page, 'Platillos');
await page.locator('button:has-text("Nuevo Platillo")').click();
await page.locator('#plat-nombre').fill('Platillo sin receta QA');
await page.locator('#plat-precio').fill('50');
await page.locator('button[type="submit"]:has-text("Guardar Platillo")').click();
await esperar(1500);
const msgSinReceta = await mensajes(page);
const sinRecetaGuardado = sql(`select count(*) from platillos where nombre='Platillo sin receta QA'`)[0][0];
await captura(page, 'cw03-platillo-sin-receta-rechazado', false);
check('CW-03', 'escritorio', sinRecetaGuardado === '0', `Platillo sin ingredientes no se guarda; mensaje/validación: "${msgSinReceta.join(' | ') || 'formulario bloqueado por campo obligatorio'}"`);
await page.locator('[role="dialog"] button:has-text("Cancelar")').click();
await esperar(400);

// (b) Desactivar un insumo usado por un platillo activo: el sistema lo impide
await tab(page, 'Insumos');
await page.locator('button[aria-label="Editar Lechuga"]').click();
await page.locator('input[name="activo"]').uncheck();
await page.locator('[role="dialog"] button[type="submit"]').click();
await esperar(1500);
const msgBloqueo = await mensajes(page);
await captura(page, 'cw03-desactivar-insumo-en-uso-bloqueado', false);
check('CW-03', 'escritorio', /se usa en los siguientes platillos activos/i.test(msgBloqueo.join(' ')) && sql(`select activo from ingredientes where nombre='Lechuga'`)[0][0] === 't',
  `Desactivar Lechuga con Ensalada activa → bloqueado: "${msgBloqueo.join(' | ')}"`);
await page.locator('[role="dialog"] button:has-text("Cancelar")').click();
await esperar(400);

// (c) Desactivar Ensalada, luego Lechuga, e intentar reactivar Ensalada con receta inválida
const editarPlatillo = async (nombre, activo) => {
  await tab(page, 'Platillos');
  await page.locator(`button[aria-label="Editar receta de ${nombre}"]`).click();
  const c = page.locator('input[name="platActivo"]');
  if (activo) await c.check(); else await c.uncheck();
  await page.locator('[role="dialog"] button[type="submit"]').click();
  await esperar(1500);
  const m = await mensajes(page);
  if (await page.locator('#plat-nombre').count()) await page.locator('[role="dialog"] button:has-text("Cancelar")').click();
  await esperar(300);
  return m;
};
await editarPlatillo('Ensalada', false);
await tab(page, 'Insumos');
await page.locator('button[aria-label="Editar Lechuga"]').click();
await page.locator('input[name="activo"]').uncheck();
await page.locator('[role="dialog"] button[type="submit"]').click();
await esperar(1500);
const lechugaInactiva = sql(`select activo from ingredientes where nombre='Lechuga'`)[0][0] === 'f';
const msgReactivar = await editarPlatillo('Ensalada', true);
const ensaladaActiva = sql(`select activo from platillos where nombre='Ensalada'`)[0][0];
await captura(page, 'cw03-reactivar-receta-invalida', false);
await ir(page, 'venta');
await esperar(800);
const vendiblesDespues = await page.locator('.platillos-grid button[aria-label^="Agregar "]').evaluateAll(b => b.map(x => x.getAttribute('aria-label')));
await captura(page, 'cw03-venta-sin-receta-invalida');
check('CW-03', 'escritorio', lechugaInactiva && !vendiblesDespues.some(x => x.includes('Ensalada')) && vendiblesDespues.some(x => x.includes('Hamburguesa')),
  `Con Lechuga inactiva, reactivar Ensalada → activo=${ensaladaActiva}, mensaje "${msgReactivar.join(' | ') || 'sin mensaje'}"; Venta antes: [${vendiblesAntes.join(', ')}]; ahora: [${vendiblesDespues.join(', ')}]`);

// ---------- CW-08 y CW-09: mínimos y Avisos ----------
const estadoAviso = async (nombre) => {
  await ir(page, 'avisos');
  await page.locator('button:has-text("Actualizar")').click();
  await esperar(900);
  const card = page.locator('.aviso-card, .aviso-item, [class*="aviso"]').filter({ has: page.locator(`h4:text-is("${nombre}")`) }).first();
  return (await card.innerText()).replace(/\s+/g, ' ');
};
await ir(page, 'gestion');
await ajuste('Pan', -(saldo('Pan') - 20), 'Conteo físico QA (igual al mínimo)');
await ajuste('Carne', -(saldo('Carne') - 2000), 'Conteo físico QA (igual al mínimo)');
const panIgual = await estadoAviso('Pan'), carneIgual = await estadoAviso('Carne');
await captura(page, 'cw08-igual-al-minimo');
check('CW-08', 'escritorio', /bajo stock/i.test(panIgual) && /bajo stock/i.test(carneIgual), `Pan 20/20 → "${panIgual}"; Carne 2000/2000 → "${carneIgual}"`);
await ir(page, 'gestion');
await ajuste('Pan', -20, 'Conteo físico QA (agotado)');
const panCero = await estadoAviso('Pan'), carneSigue = await estadoAviso('Carne');
await captura(page, 'cw08-agotado');
check('CW-08', 'escritorio', /agotado/i.test(panCero) && /bajo stock/i.test(carneSigue), `Pan 0 → "${panCero}"; Carne se evalúa por separado → "${carneSigue}"`);
await ir(page, 'gestion');
await entrada('Pan', 25, 'Reposición QA');
await entrada('Carne', 2500, 'Reposición QA');
const panRepuesto = await estadoAviso('Pan'), carneRepuesta = await estadoAviso('Carne');
check('CW-08', 'escritorio', /normal/i.test(panRepuesto) && /normal/i.test(carneRepuesta), `Reposición superior: Pan 25 → "${panRepuesto}"; Carne 4500 → "${carneRepuesta}"`);
await captura(page, 'cw08-cw09-avisos-normal');

// CW-09: una fila por ingrediente; recarga y regreso a la pestaña
const nombresAvisos = await page.locator('.aviso-details h4').allInnerTexts();
const activos = sql(`select count(*) from ingredientes where activo`)[0][0];
check('CW-09', 'escritorio', new Set(nombresAvisos).size === nombresAvisos.length && String(nombresAvisos.length) === activos, `Avisos: ${nombresAvisos.length} filas únicas (${nombresAvisos.join(', ')}); ingredientes activos: ${activos}`);
// Cambiar stock desde otra pestaña y volver
const otra = await page.context().newPage(); otra.vista = 'escritorio';
await otra.goto('http://localhost:4200/gestion'); await esperar(1200);
const p2 = page; // pestaña de Avisos
await otra.bringToFront();
const pagGestion = otra;
await pagGestion.locator('.segmented-control button:has-text("Movimientos")').click();
await pagGestion.locator('.btn-group-acciones button:has-text("Ajuste")').click();
const valQ = await pagGestion.locator('#aj-ing').evaluate(s => [...s.options].find(o => o.textContent.includes('Queso (')).value);
await pagGestion.locator('#aj-ing').selectOption(valQ);
await pagGestion.locator('#aj-cant').fill(String(-(saldo('Queso') - 3)));
await pagGestion.locator('#aj-mot').fill('Conteo físico QA (CW-09)');
await pagGestion.locator('button[type="submit"]:visible').click();
await esperar(1200);
await p2.bringToFront();
await p2.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); });
await esperar(1500);
const quesoTrasVolver = (await p2.locator('.aviso-details').filter({ has: p2.locator('h4:text-is("Queso")') }).innerText()).replace(/\s+/g, ' ');
check('CW-09', 'escritorio', /Existencia actual: 3 pieza/.test(quesoTrasVolver), `Al volver a la pestaña (visibilitychange/focus) Queso muestra: "${quesoTrasVolver}" (stock real 3)`);
await p2.reload(); await esperar(1500);
const quesoTrasRecargar = (await p2.locator('.aviso-details').filter({ has: p2.locator('h4:text-is("Queso")') }).innerText()).replace(/\s+/g, ' ');
check('CW-09', 'escritorio', /Existencia actual: 3 pieza/.test(quesoTrasRecargar), `Tras recargar Queso muestra: "${quesoTrasRecargar}"`);
await captura(p2, 'cw09-avisos-tras-cambio');
await otra.close();

// Avisos a 360 px (pendiente del agente anterior)
const movil = await abrir(browser, 'movil');
await login(movil, ADMIN);
await ir(movil, 'avisos');
await esperar(800);
const filasMovil = await movil.locator('.aviso-details h4').count();
await captura(movil, 'cw09-avisos-lista');
check('CW-09', 'movil', filasMovil === nombresAvisos.length && await sinDesbordamiento(movil), `Lista de Avisos a 360 px: ${filasMovil} filas, sin desbordamiento horizontal`);

guardarRegistro('resultados-fase-a.json');
await browser.close();
