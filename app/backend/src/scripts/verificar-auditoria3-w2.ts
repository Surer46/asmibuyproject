/**
 * verificar-auditoria3-w2.ts
 * Batería de pruebas de resolución técnica para Auditoría 3 — Integrante 2 (Catálogo e Inventario).
 *
 * Valida la resolución de los hallazgos:
 * - A3-2-01 (Alta): Lectura fresca dentro de transacción tras SELECT ... FOR UPDATE en actualizarPlatillo.
 * - A3-2-02 (Media): Transacción atómica con FOR UPDATE en actualizarIngrediente (unidad inmutable y recetas activas).
 * - A3-2-03 (Media): Uso de CURRENT_TIMESTAMP en movimientos_inventario (sin NOW() AT TIME ZONE 'UTC').
 * - A3-2-04 (Baja): Protocolo unificado de bloqueos documentado y corrección de encabezado en plan.md.
 */

import Decimal from 'decimal.js';
import fs from 'fs';
import path from 'path';
import {
  CatalogoService,
  ErrorCatalogo
} from '../services/catalogo.service';
import { InventarioService } from '../services/inventario.service';
import { almacenMemoria, MovimientoInterno } from '../services/almacen-memoria';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

let pasadas = 0;
let fallidas = 0;

function ok(descripcion: string): void {
  console.log(`  ✅ [PASS] ${descripcion}`);
  pasadas++;
}

function falla(descripcion: string, detalle?: unknown): void {
  console.error(`  ❌ [FAIL] ${descripcion}`);
  if (detalle !== undefined) {
    console.error('         ', detalle);
  }
  fallidas++;
}

async function prueba(descripcion: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    ok(descripcion);
  } catch (err: any) {
    falla(descripcion, err?.message ?? err);
  }
}

function leerArchivo(rutaRelativa: string): string {
  const rutaLimpia = rutaRelativa.replace(/^\.\.\//, '');
  const posibles = [
    path.resolve(process.cwd(), rutaLimpia),
    path.resolve(process.cwd(), rutaRelativa),
    path.resolve(__dirname, rutaRelativa),
    path.resolve(__dirname, `../../${rutaLimpia}`),
    path.resolve(__dirname, `../../../${rutaLimpia}`),
    path.resolve(process.cwd(), `app/backend/${rutaLimpia}`)
  ];
  for (const p of posibles) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf-8');
    }
  }
  throw new Error(`Archivo no encontrado en las rutas evaluadas: ${rutaRelativa}`);
}

async function main() {
  console.log('\n========================================================================');
  console.log('🧪 SUITE DE RESOLUCIÓN AUDITORÍA 3 — INTEGRANTE 2 (Catálogo e Inventario)');
  console.log('========================================================================\n');

  // ─────────────────────────────────────────────────────────────────────────────
  // Sección 1: A3-2-01 — Lectura transaccional fresca en actualizarPlatillo
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('🔍 1. Hallazgo A3-2-01 (actualizarPlatillo: lectura fresca tras FOR UPDATE)');

  await prueba('actualizarPlatillo NO realiza lectura stale fuera de la transacción antes del bloqueo', async () => {
    const contenido = leerArchivo('src/services/catalogo.service.ts');
    const idxInicio = contenido.indexOf('static async actualizarPlatillo');
    const idxFin = contenido.indexOf('static async listarPlatillosPublicos');
    const bloque = contenido.slice(idxInicio, idxFin !== -1 ? idxFin : idxInicio + 4000);

    // No debe haber un obtenerPlatilloPorId previo a ejecutarTransaccion
    const posTx = bloque.indexOf('ejecutarTransaccion');
    const posLecturaPrevia = bloque.indexOf('obtenerPlatilloPorId');
    if (posLecturaPrevia !== -1 && posLecturaPrevia < posTx) {
      throw new Error('actualizarPlatillo aún lee platillo fuera de la transacción antes del bloqueo FOR UPDATE');
    }
  });

  await prueba('actualizarPlatillo consulta nombre, precio y activo dentro de SELECT ... FOR UPDATE', async () => {
    const contenido = leerArchivo('src/services/catalogo.service.ts');
    const idxInicio = contenido.indexOf('static async actualizarPlatillo');
    const bloque = contenido.slice(idxInicio, idxInicio + 3000);

    const matchForUpdate = /SELECT id, nombre, precio, activo FROM platillos WHERE id = \$1 FOR UPDATE;/i.test(bloque);
    if (!matchForUpdate) {
      throw new Error('actualizarPlatillo no selecciona campos completos (id, nombre, precio, activo) con FOR UPDATE');
    }
  });

  await prueba('actualizarPlatillo utiliza valores frescos de la fila bloqueada cuando input omite campos', async () => {
    const contenido = leerArchivo('src/services/catalogo.service.ts');
    const idxInicio = contenido.indexOf('static async actualizarPlatillo');
    const bloque = contenido.slice(idxInicio, idxInicio + 4000);

    const usaPrecioFresco = /new Decimal\(actual\.precio\)/.test(bloque);
    const usaNombreFresco = /actual\.nombre/.test(bloque);
    const usaActivoFresco = /actual\.activo/.test(bloque);

    if (!usaPrecioFresco || !usaNombreFresco || !usaActivoFresco) {
      throw new Error('actualizarPlatillo no deriva campos omitidos de la fila bloqueada fresca');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Sección 2: A3-2-02 — Transacción atómica con FOR UPDATE en actualizarIngrediente
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n🔍 2. Hallazgo A3-2-02 (actualizarIngrediente: transacción atómica con FOR UPDATE)');

  await prueba('actualizarIngrediente encapsula verificación y actualización en ejecutarTransaccion', async () => {
    const contenido = leerArchivo('src/services/catalogo.service.ts');
    const idxInicio = contenido.indexOf('static async actualizarIngrediente');
    const idxFin = contenido.indexOf('static async actualizarPlatillo');
    const bloque = contenido.slice(idxInicio, idxFin !== -1 ? idxFin : idxInicio + 4000);

    if (!bloque.includes('ejecutarTransaccion')) {
      throw new Error('actualizarIngrediente no utiliza ejecutarTransaccion');
    }
  });

  await prueba('actualizarIngrediente adquiere SELECT ... FOR UPDATE sobre el ingrediente al inicio', async () => {
    const contenido = leerArchivo('src/services/catalogo.service.ts');
    const idxInicio = contenido.indexOf('static async actualizarIngrediente');
    const bloque = contenido.slice(idxInicio, idxInicio + 4000);

    const forUpdateIng = /SELECT id, nombre, unidad, minimo, activo FROM ingredientes WHERE id = \$1 FOR UPDATE;/i.test(bloque);
    if (!forUpdateIng) {
      throw new Error('actualizarIngrediente no adquiere FOR UPDATE sobre ingredientes');
    }
  });

  await prueba('actualizarIngrediente verifica unidad inmutable con client transaccional', async () => {
    const contenido = leerArchivo('src/services/catalogo.service.ts');
    const idxInicio = contenido.indexOf('static async actualizarIngrediente');
    const bloque = contenido.slice(idxInicio, idxInicio + 4000);

    const recetasConClient = /await client\.query\('SELECT COUNT\(\*\) FROM receta_detalle/.test(bloque);
    const movsConClient = /await client\.query\('SELECT COUNT\(\*\) FROM movimientos_inventario/.test(bloque);

    if (!recetasConClient || !movsConClient) {
      throw new Error('La comprobación de unidad inmutable no utiliza el cliente transaccional');
    }
  });

  await prueba('actualizarIngrediente bloquea platillos activos concurrentes con FOR SHARE OF p al desactivar', async () => {
    const contenido = leerArchivo('src/services/catalogo.service.ts');
    const idxInicio = contenido.indexOf('static async actualizarIngrediente');
    const bloque = contenido.slice(idxInicio, idxInicio + 4000);

    const forSharePlatillos = /FOR SHARE OF p/i.test(bloque);
    if (!forSharePlatillos) {
      throw new Error('actualizarIngrediente no bloquea platillos activos con FOR SHARE OF p al verificar desactivación');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Sección 3: A3-2-03 — CURRENT_TIMESTAMP en movimientos_inventario
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n🔍 3. Hallazgo A3-2-03 (CURRENT_TIMESTAMP en movimientos_inventario)');

  await prueba('inventario.service.ts no contiene NOW() AT TIME ZONE UTC', async () => {
    const contenido = leerArchivo('src/services/inventario.service.ts');
    const tieneAtTimeZone = /NOW\(\)\s+AT\s+TIME\s+ZONE/i.test(contenido);
    if (tieneAtTimeZone) {
      throw new Error('inventario.service.ts aún contiene NOW() AT TIME ZONE, lo que desplaza el instante con TimeZone local');
    }
  });

  await prueba('registrarEntrada utiliza CURRENT_TIMESTAMP para creado_en', async () => {
    const contenido = leerArchivo('src/services/inventario.service.ts');
    const idx = contenido.indexOf('static async registrarEntrada');
    const bloque = contenido.slice(idx, idx + 1500);

    const usaCurrentTimestamp = /CURRENT_TIMESTAMP/i.test(bloque);
    if (!usaCurrentTimestamp) {
      throw new Error('registrarEntrada no utiliza CURRENT_TIMESTAMP');
    }
  });

  await prueba('registrarAjuste utiliza CURRENT_TIMESTAMP para creado_en', async () => {
    const contenido = leerArchivo('src/services/inventario.service.ts');
    const idx = contenido.indexOf('static async registrarAjuste');
    const idxFin = contenido.indexOf('static async registrarMerma');
    const bloque = contenido.slice(idx, idxFin !== -1 ? idxFin : idx + 4000);

    const usaCurrentTimestamp = /CURRENT_TIMESTAMP/i.test(bloque);
    if (!usaCurrentTimestamp) {
      throw new Error('registrarAjuste no utiliza CURRENT_TIMESTAMP');
    }
  });

  await prueba('descontarInventarioPorVenta utiliza CURRENT_TIMESTAMP para creado_en', async () => {
    const contenido = leerArchivo('src/services/inventario.service.ts');
    const idx = contenido.indexOf('static async descontarInventarioPorVenta');
    const idxFin = contenido.indexOf('static async obtenerKardexIngrediente');
    const bloque = contenido.slice(idx, idxFin !== -1 ? idxFin : idx + 9000);

    const insertConsumo = /INSERT INTO movimientos_inventario[\s\S]*?CURRENT_TIMESTAMP/i.test(bloque);
    if (!insertConsumo) {
      throw new Error('descontarInventarioPorVenta no utiliza CURRENT_TIMESTAMP en inserción de consumo');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Sección 4: A3-2-04 — Protocolo de bloqueos unificado y plan.md
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n🔍 4. Hallazgo A3-2-04 (Protocolo de bloqueos y plan.md)');

  await prueba('modulos/catalogo-inventario/plan.md tiene Estado: en revisión y Responsable: Integrante 2', async () => {
    const contenido = leerArchivo('../modulos/catalogo-inventario/plan.md');
    const lineas = contenido.split('\n').slice(0, 10).join('\n');

    if (!lineas.includes('Estado: en revisión')) {
      throw new Error('plan.md no tiene Estado: en revisión');
    }
    if (!lineas.includes('Responsable personal: Integrante 2')) {
      throw new Error('plan.md no asigna Responsable personal: Integrante 2');
    }
  });

  await prueba('docs/contratos/02-catalogo-inventario.md documenta el protocolo unificado', async () => {
    const contenido = leerArchivo('../docs/contratos/02-catalogo-inventario.md');
    const tienePlatillosForUpdate = contenido.includes('platillos') && contenido.includes('FOR UPDATE');
    const tieneIngredientesForUpdate = contenido.includes('ingredientes') && contenido.includes('FOR UPDATE');
    const tienePromosForShare = contenido.includes('FOR SHARE OF pr');

    if (!tienePlatillosForUpdate || !tieneIngredientesForUpdate || !tienePromosForShare) {
      throw new Error('02-catalogo-inventario.md no documenta el protocolo de bloqueos unificado completo');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Sección 5: Pruebas funcionales en memoria
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n🔍 5. Pruebas funcionales de catálogo e inventario (memoria)');

  almacenMemoria.ingredientes.length = 0;
  almacenMemoria.platillos.length = 0;
  almacenMemoria.recetas.length = 0;
  almacenMemoria.movimientos.length = 0;

  await prueba('Crear ingrediente y actualizarlo respetando inmutabilidad de unidad', async () => {
    const ing = await CatalogoService.crearIngrediente({ nombre: 'Leche Entera', unidad: 'ml', minimo: '1000' });
    const act = await CatalogoService.actualizarIngrediente(ing.id, { minimo: '1200' });
    if (act.minimo !== '1200.000') {
      throw new Error(`Mínimo esperado 1200.000, obtenido: ${act.minimo}`);
    }
  });

  await prueba('Rechaza cambiar unidad de ingrediente que tiene movimientos de inventario', async () => {
    const ing = almacenMemoria.ingredientes[0];
    await InventarioService.registrarEntrada({ ingredienteId: ing.id, cantidad: '500', usuarioId: 1 });

    let rechazado = false;
    try {
      await CatalogoService.actualizarIngrediente(ing.id, { unidad: 'pieza' });
    } catch (e: any) {
      if (e?.codigo === 'UNIDAD_INMUTABLE') rechazado = true;
    }
    if (!rechazado) {
      throw new Error('No rechazó cambio de unidad en ingrediente con movimientos');
    }
  });

  await prueba('Rechaza desactivar ingrediente utilizado en platillo activo', async () => {
    const ing = almacenMemoria.ingredientes[0];
    const platillo = await CatalogoService.crearPlatillo({
      nombre: 'Licuado Fresa',
      precio: '45.00',
      receta: [{ ingredienteId: ing.id, cantidad: '250' }]
    });

    let rechazado = false;
    try {
      await CatalogoService.actualizarIngrediente(ing.id, { activo: false });
    } catch (e: any) {
      if (e?.codigo === 'INGREDIENTE_EN_USO') rechazado = true;
    }
    if (!rechazado) {
      throw new Error('No rechazó desactivar ingrediente en uso por platillo activo');
    }

    // Tras desactivar el platillo, sí debe permitir desactivar el ingrediente
    await CatalogoService.actualizarPlatillo(platillo.id, { activo: false });
    const ingDesactivado = await CatalogoService.actualizarIngrediente(ing.id, { activo: false });
    if (ingDesactivado.activo !== false) {
      throw new Error('No desactivó ingrediente tras inactivar el platillo');
    }
  });

  await prueba('actualizarPlatillo preserva precio si sólo se actualiza receta', async () => {
    const ing2 = await CatalogoService.crearIngrediente({ nombre: 'Fresa Congelada', unidad: 'g', minimo: '500' });
    const p = await CatalogoService.crearPlatillo({
      nombre: 'Bowl de Frutas',
      precio: '85.50',
      receta: [{ ingredienteId: ing2.id, cantidad: '100' }]
    });

    // Actualizar solo receta
    const ing3 = await CatalogoService.crearIngrediente({ nombre: 'Arándano', unidad: 'g', minimo: '200' });
    const pActualizado = await CatalogoService.actualizarPlatillo(p.id, {
      receta: [{ ingredienteId: ing3.id, cantidad: '80' }]
    });

    if (pActualizado.precio !== '85.50') {
      throw new Error(`Precio fue alterado o perdido: esperado 85.50, obtenido ${pActualizado.precio}`);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Resumen final
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n========================================================================');
  const total = pasadas + fallidas;
  if (fallidas === 0) {
    console.log(`🏁 RESULTADO AUDITORÍA 3: ${pasadas}/${total} pruebas exitosas, 0 fallos`);
  } else {
    console.log(`🏁 RESULTADO AUDITORÍA 3: ${pasadas}/${total} exitosas, ${fallidas} FALLOS`);
    process.exit(1);
  }
  console.log('========================================================================\n');
}

main().catch((e) => {
  console.error('Error fatal al ejecutar suite:', e);
  process.exit(1);
});
