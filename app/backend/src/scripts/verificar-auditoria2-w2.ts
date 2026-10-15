/**
 * verificar-auditoria2-w2.ts
 * Script de verificación para Auditoría 2 — Integrante 2 (Catálogo e Inventario).
 * Cubre los hallazgos A2-2-01 (protocolo de bloqueo sin escalada SHARE→UPDATE)
 * y A2-2-02 (FOR UPDATE en platillo antes de editar receta_detalle).
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

async function main() {
  console.log('\n========================================================================');
  console.log('🧪 SUITE DE RESOLUCIÓN AUDITORÍA 2 — INTEGRANTE 2 (Catálogo e Inventario)');
  console.log('========================================================================\n');

  function leerServicio(nombre: string): string {
    const posiblesRutas = [
      path.resolve(__dirname, `../../src/services/${nombre}.ts`),
      path.resolve(__dirname, `../services/${nombre}.ts`),
      path.resolve(__dirname, `../services/${nombre}.js`),
      path.resolve(process.cwd(), `app/backend/src/services/${nombre}.ts`)
    ];
    for (const r of posiblesRutas) {
      if (fs.existsSync(r)) {
        return fs.readFileSync(r, 'utf-8');
      }
    }
    throw new Error(`No se pudo encontrar el archivo del servicio ${nombre} en ninguna de las rutas esperadas`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Sección 1: Verificar que descontarInventarioPorVenta NO usa FOR UPDATE en platillos (A2-2-01)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('🔍 1. Protocolo de bloqueo A2-2-01 (descontarInventarioPorVenta)');

  await prueba('El código de descontarInventarioPorVenta no contiene FOR UPDATE sobre platillos', async () => {
    const contenido = leerServicio('inventario.service');

    const inicio = contenido.indexOf('descontarInventarioPorVenta');
    if (inicio === -1) {
      throw new Error('No se encontró descontarInventarioPorVenta en inventario.service');
    }
    const fragmento = contenido.slice(inicio, inicio + 3500);

    const forUpdatePlatillos = /FROM platillos.*FOR UPDATE/i.test(fragmento);
    if (forUpdatePlatillos) {
      throw new Error('descontarInventarioPorVenta aún contiene FOR UPDATE sobre platillos (riesgo 40P01 deadlock)');
    }
  });

  await prueba('descontarInventarioPorVenta mantiene FOR UPDATE sobre ingredientes (bloqueo ordenado)', async () => {
    const contenido = leerServicio('inventario.service');

    const inicio = contenido.indexOf('descontarInventarioPorVenta');
    const fragmento = contenido.slice(inicio, inicio + 6000);

    const forUpdateIngredientes = /FROM ingredientes.*FOR UPDATE/i.test(fragmento);
    if (!forUpdateIngredientes) {
      throw new Error('descontarInventarioPorVenta no contiene FOR UPDATE sobre ingredientes');
    }
  });

  await prueba('Lectura de platillos en descontarInventarioPorVenta usa ORDER BY id determinista', async () => {
    const contenido = leerServicio('inventario.service');

    const inicio = contenido.indexOf('descontarInventarioPorVenta');
    const fragmento = contenido.slice(inicio, inicio + 3500);

    const orderById = /FROM platillos WHERE id = ANY.*ORDER BY id/i.test(fragmento);
    if (!orderById) {
      throw new Error('La consulta de platillos no tiene ORDER BY id determinista');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Sección 2: Verificar que actualizarPlatillo adquiere FOR UPDATE antes de receta_detalle (A2-2-02)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n🔍 2. Serialización en actualizarPlatillo (A2-2-02)');

  await prueba('actualizarPlatillo adquiere FOR UPDATE en platillos antes de modificar receta_detalle', async () => {
    const contenido = leerServicio('catalogo.service');

    const inicio = contenido.indexOf('actualizarPlatillo');
    if (inicio === -1) {
      throw new Error('No se encontró actualizarPlatillo en catalogo.service');
    }
    const fragmento = contenido.slice(inicio, inicio + 5000);

    const forUpdatePlatillo = /SELECT.*FROM platillos WHERE id.*FOR UPDATE/i.test(fragmento);
    if (!forUpdatePlatillo) {
      throw new Error('actualizarPlatillo no adquiere FOR UPDATE en el platillo');
    }

    const posForUpdate = fragmento.search(/SELECT.*FROM platillos WHERE id.*FOR UPDATE/i);
    const posDelete = fragmento.search(/DELETE FROM receta_detalle/i);

    if (posDelete !== -1 && posForUpdate > posDelete) {
      throw new Error('FOR UPDATE en platillo aparece DESPUÉS de DELETE en receta_detalle');
    }
  });

  await prueba('actualizarPlatillo valida existencia con RECURSO_NO_ENCONTRADO tras el bloqueo FOR UPDATE', async () => {
    const contenido = leerServicio('catalogo.service');

    const inicio = contenido.indexOf('actualizarPlatillo');
    const fragmento = contenido.slice(inicio, inicio + 5000);

    const tieneValidacion = /lockRes\.rows\.length === 0/.test(fragmento) && /RECURSO_NO_ENCONTRADO/.test(fragmento);
    if (!tieneValidacion) {
      throw new Error('Falta validación de existencia de platillo tras el FOR UPDATE');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Sección 3: Pruebas funcionales en memoria
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n🔍 3. Pruebas funcionales de Catálogo e Inventario (memoria)');

  almacenMemoria.ingredientes.length = 0;
  almacenMemoria.platillos.length = 0;
  almacenMemoria.recetas.length = 0;
  almacenMemoria.movimientos.length = 0;

  await prueba('Crear ingrediente en memoria asigna ID incremental', async () => {
    const ing = await CatalogoService.crearIngrediente({ nombre: 'Harina Fina', unidad: 'g', minimo: '500' });
    if (!ing.id || ing.nombre !== 'Harina Fina') {
      throw new Error(`Datos incorrectos: ${JSON.stringify(ing)}`);
    }
  });

  await prueba('Crear platillo en memoria con receta válida', async () => {
    const ing = almacenMemoria.ingredientes[0];
    const p = await CatalogoService.crearPlatillo({
      nombre: 'Pastel de Vainilla',
      precio: '150.00',
      receta: [{ ingredienteId: ing.id, cantidad: '200' }]
    });
    if (!p.id || p.nombre !== 'Pastel de Vainilla' || p.precio !== '150.00') {
      throw new Error(`Platillo incorrecto: ${JSON.stringify(p)}`);
    }
  });

  await prueba('Actualizar precio de platillo en memoria refleja nuevo precio', async () => {
    const p = almacenMemoria.platillos[0];
    const act = await CatalogoService.actualizarPlatillo(p.id, { precio: '180.00' });
    if (act?.precio !== '180.00') {
      throw new Error(`Precio esperado 180.00, obtenido: ${act?.precio}`);
    }
  });

  await prueba('Actualizar receta en memoria reemplaza ingredientes correctamente', async () => {
    const ing2 = await CatalogoService.crearIngrediente({ nombre: 'Azúcar Morena', unidad: 'g', minimo: '100' });
    const p = almacenMemoria.platillos[0];
    const act = await CatalogoService.actualizarPlatillo(p.id, {
      receta: [{ ingredienteId: ing2.id, cantidad: '50' }]
    });
    const receta = act?.ingredientes || [];
    if (receta.length !== 1 || receta[0].ingredienteId !== ing2.id) {
      throw new Error(`Receta incorrecta: ${JSON.stringify(receta)}`);
    }
  });

  await prueba('descontarInventarioPorVenta en memoria rechaza platillo inactivo', async () => {
    const p = almacenMemoria.platillos[0];
    await CatalogoService.actualizarPlatillo(p.id, { activo: false });
    let lanzado = false;
    try {
      await InventarioService.descontarInventarioPorVenta(null, 1, 1, [
        { platilloId: p.id, cantidadPlatillos: 1 }
      ]);
    } catch (err: any) {
      if (err?.codigo === 'PLATILLO_INACTIVO') lanzado = true;
    }
    if (!lanzado) {
      throw new Error('No rechazó platillo inactivo');
    }
    await CatalogoService.actualizarPlatillo(p.id, { activo: true });
  });

  await prueba('descontarInventarioPorVenta en memoria descuenta stock con saldo suficiente', async () => {
    const p = almacenMemoria.platillos[0];
    const ing = almacenMemoria.ingredientes.find((i) => i.nombre === 'Azúcar Morena')!;

    await InventarioService.registrarAjuste({
      ingredienteId: ing.id,
      cantidad: '500',
      motivo: 'Ajuste inicial para prueba',
      usuarioId: 1
    });

    await InventarioService.descontarInventarioPorVenta(null, 999, 1, [
      { platilloId: p.id, cantidadPlatillos: 2 }
    ]);

    // 2 platillos × 50 g = 100 g descontados de 500 g -> saldo 400 g
    const saldo = almacenMemoria.movimientos
      .filter((m: MovimientoInterno) => m.ingredienteId === ing.id)
      .reduce((acc: Decimal, m: MovimientoInterno) => acc.plus(m.cantidad), new Decimal(0));

    if (!saldo.eq(400)) {
      throw new Error(`Saldo esperado 400, obtenido: ${saldo.toString()}`);
    }
  });

  await prueba('descontarInventarioPorVenta en memoria rechaza STOCK_INSUFICIENTE', async () => {
    const p = almacenMemoria.platillos[0];
    let lanzado = false;
    try {
      await InventarioService.descontarInventarioPorVenta(null, 1000, 1, [
        { platilloId: p.id, cantidadPlatillos: 50 } // Requiere 2500 g, solo hay 400 g
      ]);
    } catch (err: any) {
      if (err?.codigo === 'STOCK_INSUFICIENTE') lanzado = true;
    }
    if (!lanzado) {
      throw new Error('No rechazó STOCK_INSUFICIENTE');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Sección 4: Verificación de migraciones empaquetadas
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n🔍 4. Verificación de migraciones empaquetadas');

  await prueba('Existen al menos 6 migraciones SQL en dist/migrations', async () => {
    const dirMig = path.resolve(__dirname, '../../dist/migrations');
    const archivos = fs.readdirSync(dirMig).filter((f) => f.endsWith('.sql'));
    if (archivos.length < 6) {
      throw new Error(`Esperadas >=6 migraciones, encontradas: ${archivos.length}`);
    }
  });

  await prueba('Migración 005 contiene protección de stock no negativo', async () => {
    const ruta = path.resolve(__dirname, '../../dist/migrations/005_proteccion_stock_no_negativo.sql');
    const sql = fs.readFileSync(ruta, 'utf-8');
    if (!sql.includes('STOCK_NEGATIVO_NO_PERMITIDO')) {
      throw new Error('Migración 005 no contiene STOCK_NEGATIVO_NO_PERMITIDO');
    }
  });

  console.log('\n========================================================================');
  const total = pasadas + fallidas;
  if (fallidas === 0) {
    console.log(`🏁 RESULTADO AUDITORÍA 2: ${pasadas}/${total} pruebas exitosas, 0 fallos`);
  } else {
    console.log(`🏁 RESULTADO AUDITORÍA 2: ${pasadas}/${total} exitosas, ${fallidas} FALLOS`);
    process.exit(1);
  }
  console.log('========================================================================\n');
}

main().catch((e) => {
  console.error('Error fatal al ejecutar suite:', e);
  process.exit(1);
});
