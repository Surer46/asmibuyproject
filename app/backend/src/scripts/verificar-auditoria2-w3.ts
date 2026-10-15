/**
 * verificar-auditoria2-w3.ts
 * Script de verificación para Auditoría 2 — Integrante 3 (Descuentos y Promociones).
 * Cubre los hallazgos:
 * - A2-3-01: Snapshot cotizado y huella de vigencia (fechaInicio y fechaFin) en contrato y revalidación.
 * - A2-3-02: Hora de evaluación efectiva post-bloqueos en revalidación (previene confirmación a 0.00 de promos expiradas).
 * - A2-3-03: Protocolo determinista de bloqueos coordinado con Integrantes 2 y 4 (sin conversiones SHARE→UPDATE ni deadlocks 40P01).
 * - A2-3-04: Evidencia integral de integración, precisión y consistencia.
 */

import Decimal from 'decimal.js';
import fs from 'fs';
import path from 'path';
import {
  PromocionesService,
  ErrorPromocion,
  ResultadoCotizacionDTO,
  PromocionDTO
} from '../services/promociones.service';
import { almacenMemoria } from '../services/almacen-memoria';

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

function inicializarAlmacenMemoria() {
  almacenMemoria.promociones = [];
  almacenMemoria.proxPromocionId = 1;
  almacenMemoria.ordenes = [];
  almacenMemoria.ordenDetalles = [];
  almacenMemoria.proxOrdenId = 1;
  almacenMemoria.proxOrdenDetalleId = 1;

  // Platillo 1: Hamburguesa Doble ($120.00)
  const p1 = almacenMemoria.platillos.find((p) => p.id === 1);
  if (p1) {
    p1.nombre = 'Hamburguesa Doble';
    p1.precio = new Decimal('120.00');
    p1.activo = true;
  } else {
    almacenMemoria.platillos.push({ id: 1, nombre: 'Hamburguesa Doble', precio: new Decimal('120.00'), activo: true });
  }

  // Platillo 2: Papas Fritas ($60.00)
  const p2 = almacenMemoria.platillos.find((p) => p.id === 2);
  if (p2) {
    p2.nombre = 'Papas Fritas';
    p2.precio = new Decimal('60.00');
    p2.activo = true;
  } else {
    almacenMemoria.platillos.push({ id: 2, nombre: 'Papas Fritas', precio: new Decimal('60.00'), activo: true });
  }
}

async function main() {
  console.log('\n========================================================================');
  console.log('🧪 SUITE DE RESOLUCIÓN AUDITORÍA 2 — INTEGRANTE 3 (Descuentos y Promociones)');
  console.log('========================================================================\n');

  inicializarAlmacenMemoria();

  // ─────────────────────────────────────────────────────────────────────────────
  // SECCIÓN 1: HALLAZGO A2-3-01 — SNAPSHOT Y HUELLA DE VIGENCIA (FECHAS DE INICIO Y FIN)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('📅 1. Snapshot cotizado y huella íntegra de vigencia (A2-3-01 / W3-05 / CW-14)');

  await prueba('PromocionAplicadaSnapshotDTO incluye fechaInicio y fechaFin', async () => {
    const tInicio = new Date('2026-10-15T10:00:00Z');
    const tFin = new Date('2026-10-15T14:00:00Z');

    const promo = await PromocionesService.crearPromocion(
      {
        nombre: 'Promo Temporal A2-1',
        platilloId: 1,
        tipo: 'PORCENTAJE',
        porcentaje: '15.00',
        duracion: 'TEMPORAL',
        fechaInicio: tInicio.toISOString(),
        fechaFin: tFin.toISOString()
      },
      1
    );

    const cotizacion = await PromocionesService.cotizarOrden(
      [{ platilloId: 1, cantidad: 2 }],
      new Date('2026-10-15T11:00:00Z')
    );

    if (!cotizacion.promocionAplicada) {
      throw new Error('Se esperaba una promoción aplicada en el snapshot');
    }

    if (cotizacion.promocionAplicada.fechaInicio !== tInicio.toISOString()) {
      throw new Error(`fechaInicio no coincide: esperada ${tInicio.toISOString()}, obtenida ${cotizacion.promocionAplicada.fechaInicio}`);
    }

    if (cotizacion.promocionAplicada.fechaFin !== tFin.toISOString()) {
      throw new Error(`fechaFin no coincide: esperada ${tFin.toISOString()}, obtenida ${cotizacion.promocionAplicada.fechaFin}`);
    }
  });

  await prueba('Rechaza con COTIZACION_DESACTUALIZADA al extender fechaFin manteniendo mismo ahorro y total', async () => {
    inicializarAlmacenMemoria();
    const tInicio = new Date('2026-10-15T10:00:00Z');
    const tFinOriginal = new Date('2026-10-15T14:00:00Z');

    const promo = await PromocionesService.crearPromocion(
      {
        nombre: 'Promo Temporal Extensión',
        platilloId: 1,
        tipo: 'PORCENTAJE',
        porcentaje: '20.00',
        duracion: 'TEMPORAL',
        fechaInicio: tInicio.toISOString(),
        fechaFin: tFinOriginal.toISOString()
      },
      1
    );

    // Cotizar a las 11:00 (dentro de la vigencia original)
    // 2 x $120.00 = $240.00; 20% descuento = $48.00; Total = $192.00
    const cotizacionPrevia = await PromocionesService.cotizarOrden(
      [{ platilloId: 1, cantidad: 2 }],
      new Date('2026-10-15T11:00:00Z')
    );

    if (cotizacionPrevia.total !== '192.00' || cotizacionPrevia.descuentoTotal !== '48.00') {
      throw new Error(`Cotización previa con valores inesperados: ${cotizacionPrevia.total}`);
    }

    // El administrador extiende fechaFin a las 18:00 (sigue siendo 20% y total $192.00)
    const tFinExtendido = new Date('2026-10-15T18:00:00Z');
    await PromocionesService.actualizarPromocion(
      promo.id,
      { fechaFin: tFinExtendido.toISOString() },
      1
    );

    // Validar consistencia con la cotización previa
    let rechazoEsperado = false;
    try {
      await PromocionesService.validarConsistenciaCotizacion(cotizacionPrevia);
    } catch (err: any) {
      if (err instanceof ErrorPromocion && err.codigo === 'COTIZACION_DESACTUALIZADA' && err.statusCode === 409) {
        rechazoEsperado = true;
        if (!err.detalles || !err.detalles.nuevaCotizacion?.promocionAplicada) {
          throw new Error('El error COTIZACION_DESACTUALIZADA debe devolver la nueva cotización con snapshot');
        }
        if (err.detalles.nuevaCotizacion.promocionAplicada.fechaFin !== tFinExtendido.toISOString()) {
          throw new Error(`La nueva cotización debe reflejar el nuevo fin ${tFinExtendido.toISOString()}`);
        }
      } else {
        throw err;
      }
    }

    if (!rechazoEsperado) {
      throw new Error('FALLO A2-3-01: Se aceptó la cotización previa sin detectar el cambio de fechaFin');
    }
  });

  await prueba('Rechaza con COTIZACION_DESACTUALIZADA al modificar fechaInicio manteniendo mismo ahorro y total', async () => {
    inicializarAlmacenMemoria();
    const tInicioOriginal = new Date('2026-10-15T10:00:00Z');
    const tFin = new Date('2026-10-15T18:00:00Z');

    const promo = await PromocionesService.crearPromocion(
      {
        nombre: 'Promo Temporal Inicio',
        platilloId: 1,
        tipo: 'PORCENTAJE',
        porcentaje: '10.00',
        duracion: 'TEMPORAL',
        fechaInicio: tInicioOriginal.toISOString(),
        fechaFin: tFin.toISOString()
      },
      1
    );

    const cotizacionPrevia = await PromocionesService.cotizarOrden(
      [{ platilloId: 1, cantidad: 1 }],
      new Date('2026-10-15T12:00:00Z')
    );

    // Modificar fechaInicio a las 09:00:00Z
    const tInicioNuevo = new Date('2026-10-15T09:00:00Z');
    await PromocionesService.actualizarPromocion(
      promo.id,
      { fechaInicio: tInicioNuevo.toISOString() },
      1
    );

    let rechazoEsperado = false;
    try {
      await PromocionesService.validarConsistenciaCotizacion(cotizacionPrevia);
    } catch (err: any) {
      if (err instanceof ErrorPromocion && err.codigo === 'COTIZACION_DESACTUALIZADA' && err.statusCode === 409) {
        rechazoEsperado = true;
      } else {
        throw err;
      }
    }

    if (!rechazoEsperado) {
      throw new Error('FALLO A2-3-01: Se aceptó la cotización previa sin detectar el cambio de fechaInicio');
    }
  });

  await prueba('Aprueba la cotización si las fechas de vigencia y parámetros permanecen idénticos', async () => {
    inicializarAlmacenMemoria();
    const tInicio = new Date('2026-10-15T10:00:00Z');
    const tFin = new Date('2026-10-15T18:00:00Z');

    await PromocionesService.crearPromocion(
      {
        nombre: 'Promo Estable',
        platilloId: 1,
        tipo: 'PORCENTAJE',
        porcentaje: '25.00',
        duracion: 'TEMPORAL',
        fechaInicio: tInicio.toISOString(),
        fechaFin: tFin.toISOString()
      },
      1
    );

    const cotizacionPrevia = await PromocionesService.cotizarOrden(
      [{ platilloId: 1, cantidad: 1 }],
      new Date('2026-10-15T12:00:00Z')
    );

    // Revalidación sin cambios
    const validada = await PromocionesService.validarConsistenciaCotizacion(cotizacionPrevia);
    if (validada.total !== cotizacionPrevia.total) {
      throw new Error(`Total alterado tras validación consistente: ${validada.total}`);
    }
    if (validada.promocionAplicada?.fechaFin !== tFin.toISOString()) {
      throw new Error('Snapshot de fechaFin alterado');
    }
  });

  await prueba('Promoción PERMANENTE registra fechaInicio: null y fechaFin: null en snapshot', async () => {
    inicializarAlmacenMemoria();
    await PromocionesService.crearPromocion(
      {
        nombre: 'Promo Permanente Clásica',
        platilloId: 2,
        tipo: 'NXM',
        n: 2,
        m: 1,
        duracion: 'PERMANENTE'
      },
      1
    );

    const cotizacion = await PromocionesService.cotizarOrden([{ platilloId: 2, cantidad: 2 }]);
    if (!cotizacion.promocionAplicada) {
      throw new Error('Promoción permanente no aplicada');
    }
    if (cotizacion.promocionAplicada.fechaInicio !== null) {
      throw new Error(`fechaInicio debe ser null para PERMANENTE, obtenida: ${cotizacion.promocionAplicada.fechaInicio}`);
    }
    if (cotizacion.promocionAplicada.fechaFin !== null) {
      throw new Error(`fechaFin debe ser null para PERMANENTE, obtenida: ${cotizacion.promocionAplicada.fechaFin}`);
    }

    const revalidada = await PromocionesService.validarConsistenciaCotizacion(cotizacion);
    if (revalidada.promocionAplicada?.id !== cotizacion.promocionAplicada.id) {
      throw new Error('Revalidación falló para promoción permanente');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SECCIÓN 2: HALLAZGO A2-3-02 — HORA DE EVALUACIÓN POST-BLOQUEOS EN REVALIDACIÓN
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n⏱️ 2. Hora de evaluación post-bloqueos en revalidación (A2-3-02 / W3-05/06 / CW-10/14)');

  await prueba('Criterio CW-10: en t == fechaFin exacto la promoción NO es vigente (fin exclusivo)', async () => {
    const tInicio = new Date('2026-10-15T12:00:00.000Z');
    const tFin = new Date('2026-10-15T14:00:00.000Z');

    const promo = {
      estado: 'ACTIVA' as const,
      duracion: 'TEMPORAL' as const,
      fechaInicio: tInicio,
      fechaFin: tFin
    };

    // 1 ms antes de fin -> VIGENTE
    const unMsAntes = new Date('2026-10-15T13:59:59.999Z');
    if (!PromocionesService.estaVigente(promo, unMsAntes)) {
      throw new Error('1 ms antes del fin debe ser vigente');
    }

    // Instante exacto de fin -> NO VIGENTE (fin exclusivo)
    if (PromocionesService.estaVigente(promo, tFin)) {
      throw new Error('En tFin exacto la promoción NO debe ser vigente (inicio inclusivo, fin exclusivo)');
    }

    // 1 ms después -> NO VIGENTE
    const unMsDespues = new Date('2026-10-15T14:00:00.001Z');
    if (PromocionesService.estaVigente(promo, unMsDespues)) {
      throw new Error('1 ms después del fin no debe ser vigente');
    }
  });

  await prueba('A2-3-02: Previene venta a total 0.00 cuando promo 100% expira durante la revalidación', async () => {
    inicializarAlmacenMemoria();
    const tInicio = new Date('2026-10-15T10:00:00Z');
    const tFin = new Date('2026-10-15T12:00:00Z');

    const promoGratis = await PromocionesService.crearPromocion(
      {
        nombre: 'Promo 100% Por Caducidad',
        platilloId: 1, // $120.00
        tipo: 'PORCENTAJE',
        porcentaje: '100.00',
        duracion: 'TEMPORAL',
        fechaInicio: tInicio.toISOString(),
        fechaFin: tFin.toISOString()
      },
      1
    );

    // 1. Cotización generada mientras la promoción estaba vigente (ej. 11:59:50Z)
    const cotizacionCero = await PromocionesService.cotizarOrden(
      [{ platilloId: 1, cantidad: 1 }],
      new Date('2026-10-15T11:59:50Z')
    );

    if (cotizacionCero.total !== '0.00' || cotizacionCero.descuentoTotal !== '120.00') {
      throw new Error(`La cotización debía dar total 0.00, dio: ${cotizacionCero.total}`);
    }

    // 2. Simulación de revalidación atómica: la transacción espera hasta después de tFin (ej. 12:00:05Z)
    // El servicio debe evaluar la hora vigente DESPUÉS de adquirir los bloqueos.
    // Si la revalidación reevalúa a fecha actual (o clock_timestamp()), la promoción ya no aplica.
    // Simulamos pasando cotizacionCero tras la expiración en memoria:
    // Para probar la lógica de detección, modificamos temporalmente el reloj o fechaFin:
    await PromocionesService.actualizarPromocion(
      promoGratis.id,
      { fechaFin: new Date(Date.now() - 1000).toISOString() }, // ya vencida
      1
    );

    let rechazoCeroEsperado = false;
    try {
      await PromocionesService.validarConsistenciaCotizacion(cotizacionCero);
    } catch (err: any) {
      if (err instanceof ErrorPromocion && err.codigo === 'COTIZACION_DESACTUALIZADA' && err.statusCode === 409) {
        rechazoCeroEsperado = true;
        // La nueva cotización calculada debe cobrar el total íntegro ($120.00) sin descuento ($0.00)
        if (err.detalles.nuevaCotizacion.total !== '120.00') {
          throw new Error(`La nueva cotización debía cobrar $120.00, cobró: ${err.detalles.nuevaCotizacion.total}`);
        }
        if (err.detalles.nuevaCotizacion.descuentoTotal !== '0.00') {
          throw new Error(`El descuento debía ser 0.00 tras expiración, fue: ${err.detalles.nuevaCotizacion.descuentoTotal}`);
        }
        if (err.detalles.nuevaCotizacion.promocionAplicada !== null) {
          throw new Error('La nueva cotización no debe tener promoción aplicada tras expiración');
        }
      } else {
        throw err;
      }
    }

    if (!rechazoCeroEsperado) {
      throw new Error('FALLO A2-3-02: Se permitió confirmar la venta con total 0.00 a pesar de haber expirado la promoción');
    }
  });

  await prueba('Inspección de código: cotizarOrden consulta clock_timestamp() post-bloqueos en modo BD', async () => {
    const contenido = leerServicio('promociones.service');

    const inicio = contenido.indexOf('static async cotizarOrden');
    if (inicio === -1) {
      throw new Error('No se encontró cotizarOrden en promociones.service');
    }
    const fragmento = contenido.slice(inicio, inicio + 4500);

    const clockTimestamp = /clock_timestamp\(\)/i.test(fragmento);
    if (!clockTimestamp) {
      throw new Error('cotizarOrden no consulta clock_timestamp() tras adquirir los bloqueos en modo DATABASE_URL');
    }

    // Verificar que clock_timestamp() está después de query(sqlPromos)
    const posPromos = fragmento.search(/db\.query\(sqlPromos/i);
    const posClock = fragmento.search(/clock_timestamp\(\)/i);

    if (posPromos !== -1 && posClock < posPromos) {
      throw new Error('clock_timestamp() se invoca ANTES de adquirir el bloqueo sobre promociones');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SECCIÓN 3: HALLAZGO A2-3-03 — PROTOCOLO DETERMINISTA DE BLOQUEOS (SIN DEADLOCKS 40P01)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n🔒 3. Protocolo determinista de bloqueos coordinado (A2-3-03 / W3-05 / CW-06)');

  await prueba('Inspección de código: Promociones adquiere FOR UPDATE en platillos en orden ASC', async () => {
    const contenido = leerServicio('promociones.service');

    const inicio = contenido.indexOf('static async cotizarOrden');
    const fragmento = contenido.slice(inicio, inicio + 2500);

    const forUpdatePlatillos = /sqlPlatillos \+= ' FOR UPDATE'/i.test(fragmento);
    if (!forUpdatePlatillos) {
      throw new Error('cotizarOrden no adquiere FOR UPDATE sobre platillos cuando bloquearParaConfirmacion es true');
    }

    const orderAsc = /ORDER BY id ASC/i.test(fragmento);
    if (!orderAsc) {
      throw new Error('La consulta de platillos no garantiza orden ORDER BY id ASC determinista');
    }
  });

  await prueba('Inspección de código: Promociones adquiere FOR SHARE OF pr en promociones en orden ASC', async () => {
    const contenido = leerServicio('promociones.service');

    const inicio = contenido.indexOf('static async cotizarOrden');
    const fragmento = contenido.slice(inicio, inicio + 3500);

    const forShareOfPr = /sqlPromos \+= ' FOR SHARE OF pr'/i.test(fragmento);
    if (!forShareOfPr) {
      throw new Error('cotizarOrden no adquiere FOR SHARE OF pr sobre promociones cuando bloquearParaConfirmacion es true');
    }

    const orderPromosAsc = /ORDER BY pr\.id ASC/i.test(fragmento);
    if (!orderPromosAsc) {
      throw new Error('La consulta de promociones no garantiza orden ORDER BY pr.id ASC');
    }
  });

  await prueba('Inspección de código: Inventario NO adquiere FOR UPDATE sobre platillos (evita SHARE→UPDATE)', async () => {
    const contenido = leerServicio('inventario.service');

    const inicio = contenido.indexOf('descontarInventarioPorVenta');
    const fragmento = contenido.slice(inicio, inicio + 3500);

    const forUpdatePlatillos = /FROM platillos.*FOR UPDATE/i.test(fragmento);
    if (forUpdatePlatillos) {
      throw new Error('descontarInventarioPorVenta adquiere FOR UPDATE sobre platillos, causando riesgo de deadlock 40P01');
    }

    const selectSimplePlatillos = /FROM platillos WHERE id = ANY\(\$1\) ORDER BY id;/i.test(fragmento);
    if (!selectSimplePlatillos) {
      throw new Error('descontarInventarioPorVenta no usa lectura determinista simple de platillos');
    }
  });

  await prueba('Inspección de código: CatalogoService adquiere platillo FOR UPDATE antes de modificar recetas', async () => {
    const contenido = leerServicio('catalogo.service');

    const inicio = contenido.indexOf('actualizarPlatillo');
    const fragmento = contenido.slice(inicio, inicio + 4000);

    const posLock = fragmento.search(/SELECT id FROM platillos WHERE id = \$1 FOR UPDATE;/i);
    const posDelete = fragmento.search(/DELETE FROM receta_detalle/i);

    if (posLock === -1) {
      throw new Error('actualizarPlatillo no adquiere FOR UPDATE en platillos');
    }
    if (posDelete !== -1 && posLock > posDelete) {
      throw new Error('FOR UPDATE en platillo aparece después de mutar receta_detalle');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SECCIÓN 4: HALLAZGO A2-3-04 — INTEGRACIÓN, CONTRATO Y PRECISIÓN DECIMAL
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n📜 4. Integración, contrato público y precisión decimal (A2-3-04)');

  await prueba('Contrato público docs/contratos/03-promociones.md documenta fechaInicio y fechaFin', async () => {
    const rutaContrato = path.resolve(process.cwd(), 'docs/contratos/03-promociones.md');
    if (!fs.existsSync(rutaContrato)) {
      throw new Error('No existe docs/contratos/03-promociones.md');
    }
    const contenidoContrato = fs.readFileSync(rutaContrato, 'utf-8');

    if (!contenidoContrato.includes('fechaInicio: string | null')) {
      throw new Error('El contrato no documenta fechaInicio: string | null en PromocionAplicadaSnapshotDTO');
    }
    if (!contenidoContrato.includes('fechaFin: string | null')) {
      throw new Error('El contrato no documenta fechaFin: string | null en PromocionAplicadaSnapshotDTO');
    }
    if (!contenidoContrato.includes('Adenda de integración — Auditoría 2')) {
      throw new Error('El contrato no contiene la adenda de integración de Auditoría 2');
    }
  });

  await prueba('Frontend app/frontend/src/app/services/promociones.service.ts actualizado con snapshot completo', async () => {
    const rutaFront = path.resolve(process.cwd(), 'app/frontend/src/app/services/promociones.service.ts');
    if (!fs.existsSync(rutaFront)) {
      throw new Error('No existe app/frontend/src/app/services/promociones.service.ts');
    }
    const contenidoFront = fs.readFileSync(rutaFront, 'utf-8');

    if (!contenidoFront.includes('fechaInicio: string | null') || !contenidoFront.includes('fechaFin: string | null')) {
      throw new Error('El servicio de frontend no incluye fechaInicio y fechaFin en PromocionAplicadaSnapshotDTO');
    }
  });

  await prueba('Regla CW-13: desempate determinista por menor ID ante igualdad de ahorro', async () => {
    inicializarAlmacenMemoria();
    // Dos promociones con id 1 y 2 que otorgan exactamente el mismo ahorro ($30.00)
    const pA = await PromocionesService.crearPromocion(
      {
        nombre: 'Promo A (25% en Platillo 1)',
        platilloId: 1, // $120.00 -> 25% = $30.00
        tipo: 'PORCENTAJE',
        porcentaje: '25.00',
        duracion: 'PERMANENTE'
      },
      1
    );

    const pB = await PromocionesService.crearPromocion(
      {
        nombre: 'Promo B (50% en Platillo 2)',
        platilloId: 2, // $60.00 -> 50% = $30.00
        tipo: 'PORCENTAJE',
        porcentaje: '50.00',
        duracion: 'PERMANENTE'
      },
      1
    );

    // Ambas aplican en una orden de 1 hamburguesa y 1 papas
    const cotizacion = await PromocionesService.cotizarOrden([
      { platilloId: 1, cantidad: 1 },
      { platilloId: 2, cantidad: 1 }
    ]);

    if (!cotizacion.promocionAplicada) {
      throw new Error('No se aplicó ninguna promoción');
    }

    if (cotizacion.promocionAplicada.id !== Math.min(pA.id, pB.id)) {
      throw new Error(`CW-13: Desempate falló; debió elegir ID ${Math.min(pA.id, pB.id)}, eligió ID ${cotizacion.promocionAplicada.id}`);
    }
    if (cotizacion.descuentoTotal !== '30.00') {
      throw new Error(`Descuento inesperado: ${cotizacion.descuentoTotal}`);
    }
  });

  await prueba('Cálculos con decimal.js respetan ROUND_HALF_UP exacto y evitan float leaks', async () => {
    // 33.33% de $120.00 = $39.996 -> redondea a $40.00
    const resA = PromocionesService.calcularAhorroDePromocion(
      { tipo: 'PORCENTAJE', porcentaje: new Decimal('33.3333333333'), n: null, m: null },
      new Decimal('120.00'),
      1
    );
    if (resA.ahorro.toString() !== '40') {
      throw new Error(`Redondeo half-up inesperado: ${resA.ahorro.toString()}`);
    }

    // 15% de 3 items a $33.33 = 3 * 33.33 = $99.99 * 0.15 = $14.9985 -> redondea a $15.00
    const resB = PromocionesService.calcularAhorroDePromocion(
      { tipo: 'PORCENTAJE', porcentaje: new Decimal('15.00'), n: null, m: null },
      new Decimal('33.33'),
      3
    );
    if (resB.ahorro.toString() !== '15') {
      throw new Error(`Redondeo half-up inesperado: ${resB.ahorro.toString()}`);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // RESUMEN FINAL
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n========================================================================');
  console.log(`🏁 RESULTADO AUDITORÍA 2 (INTEGRANTE 3): ${pasadas}/${pasadas + fallidas} pruebas exitosas, ${fallidas} fallos`);
  console.log('========================================================================\n');

  if (fallidas > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error fatal al ejecutar la suite:', err);
  process.exit(1);
});
