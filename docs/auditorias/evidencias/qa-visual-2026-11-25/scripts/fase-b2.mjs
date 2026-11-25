// Fase B: promociones y ventas — CW-05, CW-10 a CW-16, CW-06 y CW-07 (Edge, escritorio)
import { chromium, EDGE, ADMIN, T1, T2, abrir, login, ir, tab, captura, elegir, mensajes, sql, saldo, check, guardarRegistro, esperar } from './lib.mjs';

const browser = await chromium.launch({ headless: true, executablePath: EDGE });
const admin = await abrir(browser, 'escritorio');
await login(admin, ADMIN);
admin.on('dialog', d => d.accept());

// ---------------- utilidades de administración ----------------
async function nuevoPlatillo(nombre, precio, receta) {
  await ir(admin, 'gestion'); await tab(admin, 'Platillos');
  await admin.locator('button:has-text("Nuevo Platillo")').click();
  await admin.locator('#plat-nombre').fill(nombre);
  await admin.locator('#plat-precio').fill(String(precio));
  for (let i = 0; i < receta.length; i++) {
    if (i > 0) await admin.locator('button:has-text("Agregar Insumo")').click();
    const sel = admin.locator('.receta-fila select').nth(i);
    await sel.selectOption(await sel.evaluate((s, t) => [...s.options].find(o => o.textContent.includes(t))?.value, receta[i][0] + ' ('));
    await admin.locator('.receta-fila input[type="number"]').nth(i).fill(String(receta[i][1]));
  }
  await admin.locator('button[type="submit"]:has-text("Guardar Platillo")').click();
  await admin.locator('#plat-nombre').waitFor({ state: 'detached', timeout: 8000 });
}
async function editarPlatillo(nombreActual, cambios) {
  await ir(admin, 'gestion'); await tab(admin, 'Platillos');
  await admin.locator(`button[aria-label="Editar receta de ${nombreActual}"]`).click();
  if (cambios.nombre) await admin.locator('#plat-nombre').fill(cambios.nombre);
  if (cambios.precio) await admin.locator('#plat-precio').fill(String(cambios.precio));
  if (cambios.receta) for (const [ing, cant] of cambios.receta) {
    const filas = admin.locator('.receta-fila');
    const n = await filas.count();
    for (let i = 0; i < n; i++) {
      const txt = await filas.nth(i).locator('select').evaluate(s => s.options[s.selectedIndex]?.textContent || '');
      if (txt.includes(ing + ' (')) await filas.nth(i).locator('input[type="number"]').fill(String(cant));
    }
  }
  await admin.locator('button[type="submit"]:has-text("Guardar Platillo")').click();
  await admin.locator('#plat-nombre').waitFor({ state: 'detached', timeout: 8000 });
}
async function nuevaPromo({ nombre, platillo, tipo, porcentaje, n, m, inicio, fin }) {
  await ir(admin, 'gestion'); await tab(admin, 'Promociones');
  await admin.locator('button:has-text("Nueva Promoción")').first().click();
  await admin.locator('#promo-nombre').fill(nombre);
  await elegir(admin, '#promo-platillo', platillo);
  await admin.locator('#promo-tipo').selectOption(tipo);
  if (tipo === 'PORCENTAJE') await admin.locator('#promo-porcentaje').fill(String(porcentaje));
  else { await admin.locator('#promo-n').fill(String(n)); await admin.locator('#promo-m').fill(String(m)); }
  if (inicio) {
    await admin.locator('#promo-duracion').selectOption('TEMPORAL');
    await admin.locator('#promo-inicio').fill(inicio);
    await admin.locator('#promo-fin').fill(fin);
  } else await admin.locator('#promo-duracion').selectOption('PERMANENTE');
  await admin.locator('[role="dialog"] button[type="submit"]').click();
  await admin.locator('#promo-nombre').waitFor({ state: 'detached', timeout: 8000 });
  await esperar(300);
}
async function ajustarStock(ing, objetivo, motivo) {
  const dif = objetivo - saldo(ing);
  if (!dif) return;
  await ir(admin, 'gestion'); await tab(admin, 'Movimientos');
  if (dif > 0) {
    await admin.locator('.btn-group-acciones button:has-text("Entrada")').click();
    await elegir(admin, '#ent-ing', ing + ' ('); await admin.locator('#ent-cant').fill(String(dif)); await admin.locator('#ent-mot').fill(motivo);
  } else {
    await admin.locator('.btn-group-acciones button:has-text("Ajuste")').click();
    await elegir(admin, '#aj-ing', ing + ' ('); await admin.locator('#aj-cant').fill(String(dif)); await admin.locator('#aj-mot').fill(motivo);
  }
  await admin.locator('[role="dialog"] button[type="submit"]').click();
  await esperar(1200);
}
async function accionPromo(etiqueta) {
  await ir(admin, 'gestion'); await tab(admin, 'Promociones');
  await admin.locator(`button[aria-label="${etiqueta}"]`).click();
  await esperar(1200);
}

// ---------------- utilidades de venta ----------------
async function vaciar(p) {
  const b = p.locator('button[aria-label="Vaciar carrito"]');
  if (await b.isVisible().catch(() => false)) { await b.click(); await esperar(300); }
}
async function esperarCotizacion(p) {
  await esperar(400);
  await p.locator('text=Calculando promociones').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  await p.locator('.valor-total').waitFor({ timeout: 10000 });
  await esperar(300);
}
async function carrito(p, items) {
  await vaciar(p);
  for (const [nombre, n] of items) for (let i = 0; i < n; i++) await p.locator(`button[aria-label="Agregar ${nombre} al carrito"]`).click();
  await esperarCotizacion(p);
  return resumen(p);
}
async function resumen(p) {
  const t = async s => (await p.locator(s).first().isVisible().catch(() => false)) ? (await p.locator(s).first().innerText()).replace(/\s+/g, ' ').trim() : null;
  return { total: await t('.valor-total'), descuento: await t('.valor-descuento'), promo: await t('.promo-tag') };
}
async function confirmar(p) {
  await p.locator('button:has-text("Confirmar Venta")').click();
  await p.locator('.folio-badge strong').waitFor({ timeout: 10000 });
  const folio = (await p.locator('.folio-badge strong').innerText()).trim();
  const texto = (await p.locator('.modal-comprobante').innerText()).replace(/\s+/g, ' ');
  return { folio, texto };
}
async function nuevaVenta(p) { await p.locator('button:has-text("Nueva Venta")').click(); await esperar(400); }
const orden = folio => { const r = sql(`select id, total, descuento_total, metodo_pago, coalesce(promocion_nombre,''), estado, subtotal_bruto from ordenes where folio='${folio}'`)[0]; return { id: r[0], total: r[1], descuento: r[2], metodo: r[3], promo: r[4], estado: r[5], bruto: r[6] }; };
const consumo = id => Object.fromEntries(sql(`select i.nombre, -sum(m.cantidad) from movimientos_inventario m join ingredientes i on i.id=m.ingrediente_id where m.orden_id=${id} and m.tipo='CONSUMO_VENTA' group by i.nombre`).map(r => [r[0], Number(r[1])]));
const partidas = id => sql(`select nombre_platillo, precio_unitario, cantidad, unidades_cobradas, unidades_bonificadas, descuento, subtotal_neto from orden_detalle where orden_id=${id} order by id`);

// =============== Estado previo (fase B1) ===============
const folioCW05 = 'ORD-00001', folioTorta = 'ORD-00002';
const idTorta = sql(`select id from ordenes where folio='ORD-00002'`)[0][0];
await ajustarStock('Pan', 40, 'Preparación QA fase B2');
const fmt = d => { const p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const inicioTemp = new Date(Math.ceil((Date.now() + 4 * 60000) / 60000) * 60000);
const finTemp = new Date(inicioTemp.getTime() + 2 * 60000);
if (sql(`select count(*) from promociones where nombre='Taco temporal 50% B'`)[0][0] === '0')
  await nuevaPromo({ nombre: 'Taco temporal 50% B', platillo: 'Taco', tipo: 'PORCENTAJE', porcentaje: 50, inicio: fmt(inicioTemp), fin: fmt(finTemp) });
const temp = sql(`select fecha_inicio, fecha_fin from promociones where nombre='Taco temporal 50% B'`)[0];
const inicioReal = new Date(temp[0]), finReal = new Date(temp[1]);
const caja = await abrir(browser, 'escritorio');
await login(caja, T1);
let r, c, o, cons, pt;
r = await carrito(caja, [['Taco', 1]]);
check('CW-10', 'escritorio', !r.descuento && r.total === '$100.00', `Promoción B antes del inicio (${new Date().toLocaleTimeString('es-MX')} < ${inicioReal.toLocaleTimeString('es-MX')}): total ${r.total}, sin descuento`);
await vaciar(caja);

// =============== CW-15 ===============
if (sql(`select count(*) from platillos where nombre='Hamburguesa Doble'`)[0][0] === '0') await editarPlatillo('Hamburguesa', { nombre: 'Hamburguesa Doble', precio: 150, receta: [['Carne', 200]] });
const o05 = orden(folioCW05);
const pt05 = partidas(o05.id), cons05 = consumo(o05.id);
await ir(admin, 'historial'); await esperar(1000);
const tarjeta = admin.locator('.orden-card').filter({ has: admin.locator(`.folio-con-badge strong:text-is("${folioCW05}")`) });
await tarjeta.locator('button:has-text("Ver")').first().click();
await esperar(800);
const detalle = (await admin.locator('[role="dialog"]').innerText()).replace(/\s+/g, ' ');
await captura(admin, 'cw15-comprobante-historico', false);
check('CW-15', 'escritorio', pt05[0][0] === 'Hamburguesa' && pt05[0][1] === '100.00' && cons05.Carne === 300 && /Hamburguesa/.test(detalle) && !/Hamburguesa Doble/.test(detalle) && /200\.00/.test(detalle),
  `Tras renombrar a "Hamburguesa Doble", precio 150 y carne 200 g: la venta ${folioCW05} conserva "${pt05[0][0]}" a ${pt05[0][1]}, total ${o05.total} y consumo de carne ${cons05.Carne} g; detalle UI: "${detalle.slice(0, 160)}…"`);
await admin.keyboard.press('Escape'); await esperar(300);

// =============== CW-16 ===============
const panAntesAnular = saldo('Pan');
const resumenTotal = async () => (await admin.locator('.metric-value').first().innerText()).trim();
await ir(admin, 'venta'); await ir(admin, 'historial'); await esperar(1000);
const totalAntes = await resumenTotal();
const tarjetaT = admin.locator('.orden-card').filter({ has: admin.locator(`.folio-con-badge strong:text-is("${folioTorta}")`) });
await tarjetaT.locator('button:has-text("Anular")').click();
await admin.locator('#motivoAnulacion').fill('Cliente canceló el pedido (QA)');
await admin.locator('[role="dialog"] button:has-text("Confirmar Anulación")').click();
await esperar(1500);
await ir(admin, 'venta'); await ir(admin, 'historial'); await esperar(1000);
const totalDespues = await resumenTotal();
await captura(admin, 'cw16-historial-anulada');
let ot = orden(folioTorta);
const anulador = sql(`select u.correo, o.motivo_anulacion, o.anulado_en from ordenes o join usuarios u on u.id=o.usuario_anulacion_id where o.id=${idTorta}`)[0];
check('CW-16', 'escritorio', ot.estado === 'ANULADA' && saldo('Pan') === panAntesAnular && Number(totalAntes.replace(/[$,]/g, '')) - Number(totalDespues.replace(/[$,]/g, '')) === 170,
  `Orden ${folioTorta} ${ot.estado} por ${anulador[0]} con motivo "${anulador[1]}"; Pan sin reintegro (${panAntesAnular}→${saldo('Pan')}); Total vigente ${totalAntes} → ${totalDespues}`);
const api = (p, metodo, url, cuerpo) => p.evaluate(async ([metodo, url, cuerpo]) => {
  const csrf = (document.cookie.match(/asmibuy_csrf=([^;]+)/) || [])[1] || '';
  const r = await fetch(url, { method: metodo, credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': decodeURIComponent(csrf) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  return { status: r.status, cuerpo: await r.text() };
}, [metodo, url, cuerpo]);
const repetir = await api(admin, 'POST', `/api/v1/ventas/${idTorta}/anular`, { motivo: 'Segundo intento con otro motivo (QA)' });
const tras = sql(`select motivo_anulacion, usuario_anulacion_id, anulado_en from ordenes where id=${idTorta}`)[0];
check('CW-16', 'escritorio', tras[0] === anulador[1] && tras[2] === anulador[2] && saldo('Pan') === panAntesAnular, `Repetir la anulación → HTTP ${repetir.status}; motivo, autor y fecha sin cambios ("${tras[0]}"); sin reintegro`);
await ir(caja, 'historial'); await esperar(1000);
const botonesAnularTrab = await caja.locator('button:has-text("Anular Venta")').count();
const ultima = sql(`select id from ordenes where estado='CONFIRMADA' order by id desc limit 1`)[0][0];
const trabDirecto = await api(caja, 'POST', `/api/v1/ventas/${ultima}/anular`, { motivo: 'Trabajador intenta anular (QA)' });
await captura(caja, 'cw16-trabajador-sin-anular', false);
check('CW-16', 'escritorio', botonesAnularTrab === 0 && trabDirecto.status === 403 && orden(sql(`select folio from ordenes where id=${ultima}`)[0][0]).estado === 'CONFIRMADA', `Trabajador: ${botonesAnularTrab} botones «Anular Venta» en Historial; petición directa → HTTP ${trabDirecto.status}`);
await ir(caja, 'venta');

// =============== CW-07 ===============
const nOrdenes = () => Number(sql(`select count(*) from ordenes`)[0][0]);
let n0 = nOrdenes();
await carrito(caja, [['Torta', 1]]);
await caja.locator('button:has-text("Confirmar Venta")').dblclick();
await caja.locator('.folio-badge strong').waitFor({ timeout: 10000 });
await esperar(1500);
check('CW-07', 'escritorio', nOrdenes() === n0 + 1, `Doble clic en Confirmar: órdenes ${n0} → ${nOrdenes()} (una sola)`);
await nuevaVenta(caja);
// Respuesta perdida: el servidor confirma pero el navegador no recibe la respuesta
let cuerpoEnviado = null;
await caja.route('**/api/v1/ventas/confirmar', async route => {
  cuerpoEnviado = route.request().postDataJSON();
  await route.fetch();          // llega al servidor y se confirma
  await route.abort('failed');  // el navegador no recibe la respuesta
});
n0 = nOrdenes();
await carrito(caja, [['Torta', 1]]);
await caja.locator('button:has-text("Confirmar Venta")').click();
await esperar(2500);
const msgIncierto = await mensajes(caja);
await caja.unroute('**/api/v1/ventas/confirmar');
const bannerAntes = await caja.locator('.banner-recuperacion').isVisible();
await captura(caja, 'cw07-respuesta-perdida', false);
await caja.reload(); await esperar(2000);
const bannerTrasRecarga = await caja.locator('.banner-recuperacion').isVisible();
await caja.locator('button:has-text("Verificar Estado")').click();
await esperar(2500);
const msgRecuperado = await mensajes(caja);
await captura(caja, 'cw07-recuperada-tras-recarga', false);
const recuperada = sql(`select folio from ordenes where clave_idempotencia='${cuerpoEnviado.claveIdempotencia}'`);
check('CW-07', 'escritorio', nOrdenes() === n0 + 1 && recuperada.length === 1 && bannerAntes && bannerTrasRecarga,
  `Respuesta perdida: aviso "${msgIncierto.join(' | ')}"; banner de pendiente visible ${bannerAntes} y tras recargar ${bannerTrasRecarga}; Verificar → "${msgRecuperado.join(' | ')}"; órdenes ${n0} → ${nOrdenes()}, folio ${recuperada[0]?.[0]}`);
const otraCarga = { ...cuerpoEnviado, items: cuerpoEnviado.items.map(i => ({ ...i, cantidad: i.cantidad + 1 })) };
const reuso = await api(caja, 'POST', '/api/v1/ventas/confirmar', otraCarga);
check('CW-07', 'escritorio', reuso.status >= 400 && nOrdenes() === n0 + 1, `Misma clave con otro contenido → HTTP ${reuso.status} ${(reuso.cuerpo.match(/"codigo":"([^"]+)"/) || [])[1] || ''}; sin orden nueva`);
if (await caja.locator('button:has-text("Nueva Venta")').isVisible().catch(() => false)) await nuevaVenta(caja);
await caja.reload(); await esperar(1500);

// =============== CW-06: dos cajas por la última unidad ===============
await ajustarStock('Pan', 1, 'Última unidad (QA CW-06)');
const caja2 = await abrir(browser, 'escritorio');
await login(caja2, T2);
await carrito(caja, [['Torta', 1]]);
await carrito(caja2, [['Torta', 1]]);
n0 = nOrdenes();
const [ra, rb] = await Promise.all([
  caja.locator('button:has-text("Confirmar Venta")').click().then(() => esperar(3000)).then(() => mensajes(caja)),
  caja2.locator('button:has-text("Confirmar Venta")').click().then(() => esperar(3000)).then(() => mensajes(caja2))
]);
const exitos = [await caja.locator('.folio-badge').isVisible(), await caja2.locator('.folio-badge').isVisible()].filter(Boolean).length;
await captura(caja, 'cw06-caja1', false); await captura(caja2, 'cw06-caja2', false);
const negativos = sql(`select count(*) from ingredientes i where (select coalesce(sum(cantidad),0) from movimientos_inventario where ingrediente_id=i.id) < 0`)[0][0];
check('CW-06', 'escritorio', exitos === 1 && nOrdenes() === n0 + 1 && saldo('Pan') === 0 && negativos === '0' && [...ra, ...rb].some(m => /insuficiente/i.test(m)),
  `Dos cajas con 1 pan: ${exitos} venta confirmada; mensajes caja 1 "${ra.join(' | ')}", caja 2 "${rb.join(' | ')}"; Pan ${saldo('Pan')}; ingredientes negativos ${negativos}`);
await ajustarStock('Pan', 40, 'Reposición tras CW-06');
await caja2.context().close();
for (const p of [caja]) { if (await p.locator('button:has-text("Nueva Venta")').isVisible().catch(() => false)) await nuevaVenta(p); }

// =============== CW-10 (desactivar, reactivar, retirar) ===============
await accionPromo('Pausar Torta 15%');
await caja.reload(); await esperar(1200);
r = await carrito(caja, [['Torta', 2]]);
check('CW-10', 'escritorio', !r.descuento && r.total === '$200.00', `Torta 15% desactivada → 2 Tortas ${r.total}, sin descuento`);
await accionPromo('Activar Torta 15%');
await caja.reload(); await esperar(1200);
r = await carrito(caja, [['Torta', 2]]);
check('CW-10', 'escritorio', r.descuento === '-$30.00', `Reactivada → descuento ${r.descuento}`);
await accionPromo('Retirar Torta 15%');
await tab(admin, 'Promociones');
const filaRetirada = admin.locator('.item-fila').filter({ hasText: 'Torta 15%' });
const botonesRetirada = await filaRetirada.locator('button').count();
await captura(admin, 'cw10-promocion-retirada', false);
await caja.reload(); await esperar(1200);
r = await carrito(caja, [['Torta', 2]]);
check('CW-10', 'escritorio', !r.descuento && botonesRetirada === 0 && sql(`select estado from promociones where nombre='Torta 15%'`)[0][0] === 'RETIRADA', `Retirada: sin descuento (${r.total}); la fila no ofrece editar ni reactivar (${botonesRetirada} botones)`);

// =============== CW-10 (temporal: inicio inclusivo, fin exclusivo) ===============
const esperarHasta = async (t) => { const ms = t.getTime() - Date.now(); if (ms > 0) { console.log(`… esperando ${Math.round(ms / 1000)} s`); await esperar(ms); } };
await esperarHasta(new Date(inicioReal.getTime() + 5000));
await caja.reload(); await esperar(1000);
r = await carrito(caja, [['Taco', 1]]);
await captura(caja, 'cw10-temporal-vigente', false);
check('CW-10', 'escritorio', r.descuento === '-$50.00', `Dentro de la vigencia (${new Date().toLocaleTimeString('es-MX')}, inicio ${inicioReal.toLocaleTimeString('es-MX')}): ${r.descuento} → ${r.total}`);
await esperarHasta(new Date(finReal.getTime() + 5000));
await caja.reload(); await esperar(1000);
r = await carrito(caja, [['Taco', 1]]);
check('CW-10', 'escritorio', !r.descuento && r.total === '$100.00', `Después del fin (${new Date().toLocaleTimeString('es-MX')}, fin ${finReal.toLocaleTimeString('es-MX')}): ${r.total}, sin descuento`);
const limites = sql(`select (fecha_inicio <= fecha_inicio) and not (fecha_fin < fecha_fin) from promociones where nombre='Taco temporal 50% B'`);
await vaciar(caja);

guardarRegistro('resultados-fase-b2.json');
await browser.close();
