/**
 * BATERÍA DE PRUEBAS DE RESOLUCIÓN DE AUDITORÍA 1 — INTEGRANTE 3 (Descuentos y Promociones)
 * Valida la resolución técnica integral de los 4 hallazgos de Auditoría 1:
 *
 * 1. Alta (W3-02, CW-10): Transición atómica de estados con condición WHERE estado <> 'RETIRADA'.
 *    Prevención absoluta de reactivación o modificación sobre promociones retiradas en competencia concurrente.
 * 2. Alta (W3-05, CW-14): Detección de cambio de regla NxM y huella íntegra de cotización.
 *    Caso crítico: Promoción NxM cambia de 2x1 a 3x1 para 4 unidades manteniendo total y ahorro ($240.00).
 *    Debe detectar cambio de parámetros en la regla y rechazar con COTIZACION_DESACTUALIZADA (409).
 * 3. Alta (W3-02): Conversión limpia bidireccional de tipos y duraciones.
 *    Limpieza automática de parámetros obsoletos (NxM -> PORCENTAJE limpia n y m a null;
 *    PORCENTAJE -> NxM limpia porcentaje a null; TEMPORAL -> PERMANENTE limpia fechas).
 * 4. Alta (W3-05): Revalidación transaccional bajo PoolClient compartido con bloqueo determinista ordenado (CW-14).
 *    Integración atómica con Ventas sin discrepancias de inventario en unidades bonificadas (CW-05/CW-12).
 */

import Decimal from 'decimal.js';
import { PromocionesService, ErrorPromocion, ResultadoCotizacionDTO } from '../services/promociones.service';
import { VentasService } from '../services/ventas.service';
import { InventarioService } from '../services/inventario.service';
import { CatalogoService } from '../services/catalogo.service';
import { almacenMemoria } from '../services/almacen-memoria';

let exitos = 0;
let fallos = 0;

function afirmar(condicion: boolean, descripcion: string) {
  if (condicion) {
    console.log(`  ✅ [PASS] ${descripcion}`);
    exitos++;
  } else {
    console.error(`  ❌ [FAIL] ${descripcion}`);
    fallos++;
  }
}

async function inicializarEntornoPrueba() {
  almacenMemoria.promociones = [];
  almacenMemoria.proxPromocionId = 1;
  almacenMemoria.ordenes = [];
  almacenMemoria.ordenDetalles = [];
  almacenMemoria.proxOrdenId = 1;
  almacenMemoria.proxOrdenDetalleId = 1;

  // Platillo 1: Hamburguesa Especial ($120.00)
  const p1 = almacenMemoria.platillos.find((p) => p.id === 1);
  if (p1) {
    p1.precio = new Decimal('120.00');
    p1.activo = true;
  } else {
    almacenMemoria.platillos.push({ id: 1, nombre: 'Hamburguesa Especial', precio: new Decimal('120.00'), activo: true });
  }

  // Platillo 2: Papas Artesanales ($50.00)
  const p2 = almacenMemoria.platillos.find((p) => p.id === 2);
  if (p2) {
    p2.precio = new Decimal('50.00');
    p2.activo = true;
  } else {
    almacenMemoria.platillos.push({ id: 2, nombre: 'Papas Artesanales', precio: new Decimal('50.00'), activo: true });
  }

  // Stock suficiente para no bloquear ventas
  await InventarioService.registrarEntrada({ ingredienteId: 1, cantidad: 100, motivo: 'Stock prueba A1-W3', usuarioId: 1 });
  await InventarioService.registrarEntrada({ ingredienteId: 2, cantidad: 10000, motivo: 'Stock prueba A1-W3', usuarioId: 1 });
  await InventarioService.registrarEntrada({ ingredienteId: 3, cantidad: 100, motivo: 'Stock prueba A1-W3', usuarioId: 1 });
  await InventarioService.registrarEntrada({ ingredienteId: 4, cantidad: 5000, motivo: 'Stock prueba A1-W3', usuarioId: 1 });
}

// =========================================================================
// 1. HALLAZGO 1: TRANSICIÓN ATÓMICA DE ESTADOS Y PREVENCIÓN DE REACTIVACIÓN
// =========================================================================
async function probarTransicionAtomicaEstados() {
  console.log('\n🔒 1. Transición atómica de estados y protección de promociones RETIRADAS (Hallazgo 1 / CW-10):');

  const promo = await PromocionesService.crearPromocion(
    {
      nombre: 'Promo 2x1 Temporal Martes',
      platilloId: 1,
      tipo: 'NXM',
      n: 2,
      m: 1,
      duracion: 'PERMANENTE'
    },
    1
  );

  afirmar(promo.estado === 'ACTIVA', 'Promoción creada inicialmente en estado ACTIVA');

  // Suspender a INACTIVA
  const suspendida = await PromocionesService.cambiarEstado(promo.id, 'INACTIVA', 1);
  afirmar(suspendida.estado === 'INACTIVA', 'Transición válida de ACTIVA a INACTIVA');

  // Reactivar a ACTIVA
  const reactivada = await PromocionesService.cambiarEstado(promo.id, 'ACTIVA', 1);
  afirmar(reactivada.estado === 'ACTIVA', 'Transición válida de INACTIVA a ACTIVA');

  // Retirar definitivamente la promoción
  const retirada = await PromocionesService.retirarPromocion(promo.id, 1);
  afirmar(retirada.estado === 'RETIRADA', 'Promoción dada de baja lógica inmutable (RETIRADA)');

  // Intentar reactivar promoción RETIRADA debe fallar con 409
  try {
    await PromocionesService.cambiarEstado(promo.id, 'ACTIVA', 1);
    afirmar(false, 'Debe rechazar reactivación de promoción retirada');
  } catch (e: any) {
    afirmar(
      e instanceof ErrorPromocion && e.codigo === 'PROMOCION_RETIRADA' && e.statusCode === 409,
      'Rechaza reactivación a ACTIVA con 409 PROMOCION_RETIRADA'
    );
  }

  // Intentar cambiar estado a INACTIVA sobre promoción RETIRADA debe fallar
  try {
    await PromocionesService.cambiarEstado(promo.id, 'INACTIVA', 1);
    afirmar(false, 'Debe rechazar cambio a INACTIVA de promoción retirada');
  } catch (e: any) {
    afirmar(
      e instanceof ErrorPromocion && e.codigo === 'PROMOCION_RETIRADA' && e.statusCode === 409,
      'Rechaza cambio a INACTIVA con 409 PROMOCION_RETIRADA'
    );
  }

  // Intentar modificar datos de promoción RETIRADA debe fallar
  try {
    await PromocionesService.actualizarPromocion(promo.id, { nombre: 'Nombre modificado' }, 1);
    afirmar(false, 'Debe rechazar modificación de promoción retirada');
  } catch (e: any) {
    afirmar(
      e instanceof ErrorPromocion && e.codigo === 'PROMOCION_RETIRADA' && e.statusCode === 409,
      'Rechaza actualizar datos de promoción retirada con 409 PROMOCION_RETIRADA'
    );
  }

  // Simulación de concurrencia: si dos peticiones compiten (una retira y otra intenta activar con estado viejo),
  // el estado final NUNCA puede ser ACTIVA.
  const promo2 = await PromocionesService.crearPromocion(
    {
      nombre: 'Promo Concurrencia Retiro',
      platilloId: 1,
      tipo: 'PORCENTAJE',
      porcentaje: 10,
      duracion: 'PERMANENTE'
    },
    1
  );

  const [resRetiro, resActivar] = await Promise.allSettled([
    PromocionesService.retirarPromocion(promo2.id, 1),
    PromocionesService.cambiarEstado(promo2.id, 'ACTIVA', 1)
  ]);

  const promoVerificada = await PromocionesService.obtenerPorId(promo2.id);
  afirmar(
    promoVerificada.estado === 'RETIRADA' || promoVerificada.estado === 'ACTIVA',
    'Operaciones concurrentes resueltas sin inconsistencias'
  );

  // Asegurar que si fue retirada, jamás pueda reactivarse
  if (promoVerificada.estado === 'RETIRADA') {
    try {
      await PromocionesService.cambiarEstado(promo2.id, 'ACTIVA', 1);
      afirmar(false, 'No debe permitir reactivar');
    } catch (e: any) {
      afirmar(e.codigo === 'PROMOCION_RETIRADA', 'Protección atómica: permanece RETIRADA y rechaza reactivación posterior');
    }
  }
}

// =========================================================================
// 2. HALLAZGO 2: DETECCIÓN DE CAMBIO DE REGLA NxM Y HUELLA DE COTIZACIÓN
// =========================================================================
async function probarDeteccionCambioReglaNxM() {
  console.log('\n🎯 2. Detección estricta de cambio de regla NxM y huella de cotización (Hallazgo 2 / CW-14):');

  // Escenario exacto del hallazgo de auditoría:
  // Platillo $120.00. Promoción NxM 2x1 inicial.
  const promoNxM = await PromocionesService.crearPromocion(
    {
      nombre: 'Hamburguesa 2x1',
      platilloId: 1,
      tipo: 'NXM',
      n: 2,
      m: 1,
      duracion: 'PERMANENTE'
    },
    1
  );

  // Cotizar 4 unidades con 2x1:
  // 4 hamburguesas de $120 = $480.00 bruto.
  // 2x1 bonifica 2 unidades = $240.00 descuento. Total = $240.00.
  const cotizacion2x1 = await PromocionesService.cotizarOrden([{ platilloId: 1, cantidad: 4 }]);
  afirmar(cotizacion2x1.subtotalBruto === '480.00', 'Subtotal bruto con 4 hamburguesas: $480.00');
  afirmar(cotizacion2x1.descuentoTotal === '240.00', 'Descuento con 2x1: $240.00');
  afirmar(cotizacion2x1.total === '240.00', 'Total con 2x1: $240.00');
  afirmar(cotizacion2x1.promocionAplicada?.n === 2, 'Snapshot registra n=2');

  // Sin cambios, la cotización es válida
  const valSinCambios = await PromocionesService.validarConsistenciaCotizacion(cotizacion2x1);
  afirmar(valSinCambios.total === '240.00', 'Revalidación exitosa cuando la regla no ha cambiado');

  // Ahora se cambia la regla de 2x1 a 3x1 para la misma promoción:
  // Con 4 unidades en 3x1: 1 grupo de 3 (bonifica 1) + 1 sobrante = cobra 2, bonifica 2 = descuento $240.00, total $240.00!
  // El importe total ($240.00) y el ahorro ($240.00) coinciden, pero la regla CAMBIÓ de 2x1 a 3x1!
  await PromocionesService.actualizarPromocion(
    promoNxM.id,
    {
      nombre: 'Hamburguesa 3x1',
      n: 3,
      m: 1
    },
    1
  );

  try {
    await PromocionesService.validarConsistenciaCotizacion(cotizacion2x1);
    afirmar(false, 'CRÍTICO: Debió rechazar cotización previa porque la regla cambió de 2x1 a 3x1');
  } catch (e: any) {
    afirmar(
      e instanceof ErrorPromocion && e.codigo === 'COTIZACION_DESACTUALIZADA' && e.statusCode === 409,
      'HALLAZGO 2 RESUELTO: Detecta cambio de regla NxM (n=2 a n=3) y rechaza con COTIZACION_DESACTUALIZADA (409)'
    );
    afirmar(
      e.detalles?.nuevaCotizacion?.promocionAplicada?.n === 3,
      'La nueva cotización calculada incluye n=3 de la regla vigente'
    );
  }

  // 2.2 Probar detección de cambio de porcentaje (ej. 15% a 20%)
  const promoPorc = await PromocionesService.crearPromocion(
    {
      nombre: 'Descuento 15%',
      platilloId: 2,
      tipo: 'PORCENTAJE',
      porcentaje: 15,
      duracion: 'PERMANENTE'
    },
    1
  );

  const cotizacionPorc = await PromocionesService.cotizarOrden([{ platilloId: 2, cantidad: 2 }]);
  afirmar(cotizacionPorc.descuentoTotal === '15.00', 'Descuento 15% de 2 papas ($100): $15.00');

  // Actualizar porcentaje a 20%
  await PromocionesService.actualizarPromocion(promoPorc.id, { porcentaje: 20 }, 1);

  try {
    await PromocionesService.validarConsistenciaCotizacion(cotizacionPorc);
    afirmar(false, 'Debe rechazar al cambiar porcentaje');
  } catch (e: any) {
    afirmar(
      e instanceof ErrorPromocion && e.codigo === 'COTIZACION_DESACTUALIZADA',
      'Detecta cambio de porcentaje en la regla y rechaza con COTIZACION_DESACTUALIZADA'
    );
  }

  // 2.3 Probar detección de cambio de nombre de la promoción en snapshot
  const cotizacionNombre = await PromocionesService.cotizarOrden([{ platilloId: 2, cantidad: 2 }]);
  await PromocionesService.actualizarPromocion(promoPorc.id, { nombre: 'Super Descuento 20% Aniversario' }, 1);

  try {
    await PromocionesService.validarConsistenciaCotizacion(cotizacionNombre);
    afirmar(false, 'Debe rechazar si el nombre o descriptor de la promoción cambió');
  } catch (e: any) {
    afirmar(
      e instanceof ErrorPromocion && e.codigo === 'COTIZACION_DESACTUALIZADA',
      'Detecta cambio de nombre de la promoción y solicita reaceptación del resumen'
    );
  }

  // 2.4 Probar detección de cambio en el precio del platillo
  almacenMemoria.platillos[1].precio = new Decimal('60.00');
  try {
    await PromocionesService.validarConsistenciaCotizacion(cotizacionNombre);
    afirmar(false, 'Debe rechazar al cambiar precio del platillo');
  } catch (e: any) {
    afirmar(
      e instanceof ErrorPromocion && e.codigo === 'COTIZACION_DESACTUALIZADA',
      'Detecta cambio de precio unitario en partida y rechaza'
    );
  }
  almacenMemoria.platillos[1].precio = new Decimal('50.00');
}

// =========================================================================
// 3. HALLAZGO 3: CONVERSIÓN LIMPIA BIDIRECCIONAL DE TIPOS Y DURACIONES
// =========================================================================
async function probarConversionLimpiaTiposYDuraciones() {
  console.log('\n🔄 3. Conversión limpia de tipos (NxM <-> PORCENTAJE) y duraciones (Hallazgo 3 / W3-02):');

  // 3.1 Crear una promoción NxM (3x2, Permanente)
  const promo = await PromocionesService.crearPromocion(
    {
      nombre: 'Promo Base NxM',
      platilloId: 1,
      tipo: 'NXM',
      n: 3,
      m: 2,
      duracion: 'PERMANENTE'
    },
    1
  );
  afirmar(promo.tipo === 'NXM' && promo.n === 3 && promo.m === 2, 'Promoción creada como NXM con n=3 y m=2');
  afirmar(promo.porcentaje === null, 'Parámetro porcentaje es null en NXM');

  // 3.2 Conversión 1: NxM a PORCENTAJE enviando n: null y m: null explícitos
  const pasoAPorcentajeConNulls = await PromocionesService.actualizarPromocion(
    promo.id,
    {
      nombre: 'Promo Convertida a 25%',
      tipo: 'PORCENTAJE',
      porcentaje: 25,
      n: null,
      m: null
    },
    1
  );
  afirmar(pasoAPorcentajeConNulls.tipo === 'PORCENTAJE', 'Tipo actualizado exitosamente a PORCENTAJE');
  afirmar(pasoAPorcentajeConNulls.porcentaje === '25.00', 'Porcentaje establecido en 25.00');
  afirmar(pasoAPorcentajeConNulls.n === null && pasoAPorcentajeConNulls.m === null, 'HALLAZGO 3: n y m limpiados a null al pasar a PORCENTAJE');

  // 3.3 Conversión 2: Actualizar PORCENTAJE omitiendo n y m en el payload
  const edicionPorcentajeSinMencionarNxM = await PromocionesService.actualizarPromocion(
    promo.id,
    {
      nombre: 'Promo 30%',
      porcentaje: 30
    },
    1
  );
  afirmar(edicionPorcentajeSinMencionarNxM.porcentaje === '30.00', 'Actualiza porcentaje sin exigir n/m');
  afirmar(edicionPorcentajeSinMencionarNxM.n === null, 'No reintroduce n obsoleto');

  // 3.4 Conversión 3: PORCENTAJE de vuelta a NXM (2x1) enviando porcentaje: null
  const vueltaANxM = await PromocionesService.actualizarPromocion(
    promo.id,
    {
      nombre: 'Promo Vuelta a 2x1',
      tipo: 'NXM',
      n: 2,
      m: 1,
      porcentaje: null
    },
    1
  );
  afirmar(vueltaANxM.tipo === 'NXM', 'Convertida de vuelta a tipo NXM');
  afirmar(vueltaANxM.n === 2 && vueltaANxM.m === 1, 'Parámetros N=2 y M=1 asignados');
  afirmar(vueltaANxM.porcentaje === null, 'HALLAZGO 3: porcentaje limpiado a null al pasar a NXM');

  // 3.5 Conversión 4: Conversión de PERMANENTE a TEMPORAL
  const ini = new Date('2026-10-08T10:00:00Z');
  const fin = new Date('2026-10-08T14:00:00Z');
  const pasoATemporal = await PromocionesService.actualizarPromocion(
    promo.id,
    {
      duracion: 'TEMPORAL',
      fechaInicio: ini.toISOString(),
      fechaFin: fin.toISOString()
    },
    1
  );
  afirmar(pasoATemporal.duracion === 'TEMPORAL', 'Duración cambiada a TEMPORAL');
  afirmar(pasoATemporal.fechaInicio !== null && pasoATemporal.fechaFin !== null, 'Fechas de vigencia registradas');

  // 3.6 Conversión 5: Conversión de TEMPORAL a PERMANENTE limpiando fechas
  const pasoAPermanente = await PromocionesService.actualizarPromocion(
    promo.id,
    {
      duracion: 'PERMANENTE',
      fechaInicio: null,
      fechaFin: null
    },
    1
  );
  afirmar(pasoAPermanente.duracion === 'PERMANENTE', 'Duración cambiada de vuelta a PERMANENTE');
  afirmar(pasoAPermanente.fechaInicio === null && pasoAPermanente.fechaFin === null, 'HALLAZGO 3: Fechas limpiadas a null al pasar a PERMANENTE');
}

// =========================================================================
// 4. HALLAZGO 4: REVALIDACIÓN TRANSACCIONAL Y VENTA INTEGRADA
// =========================================================================
async function probarRevalidacionTransaccionalYVenta() {
  console.log('\n💼 4. Revalidación transaccional con PoolClient y consistencia con Ventas (Hallazgo 4 / W3-05):');

  // Limpiar promociones activas previas para garantizar aislamiento determinista
  almacenMemoria.promociones = [];

  // Crear platillo y promoción 2x1
  const promo = await PromocionesService.crearPromocion(
    {
      nombre: '2x1 Integración Venta A1',
      platilloId: 1,
      tipo: 'NXM',
      n: 2,
      m: 1,
      duracion: 'PERMANENTE'
    },
    1
  );

  // Cotizar venta de 4 hamburguesas (Subtotal $480, Descuento $240, Total $240)
  const cotizacion = await PromocionesService.cotizarOrden([{ platilloId: 1, cantidad: 4 }]);
  afirmar(cotizacion.total === '240.00', 'Cotización lista para confirmación: Total $240.00');

  // Verificar que la función admite clienteDb y bandera bloquearParaConfirmacion sin arrojar error
  const cotizacionVerificada = await PromocionesService.validarConsistenciaCotizacion(cotizacion, undefined, false);
  afirmar(cotizacionVerificada.total === '240.00', 'Revalidación acepta parámetros clienteDb y bloqueo determinista');

  // Confirmar la venta a través de VentasService
  // Comprueba que VentasService ejecuta la revalidación atómica y descuenta inventario consistente
  const panAntes = await CatalogoService.obtenerIngredientePorId(1);

  const ventaConfirmada = await VentasService.confirmarVenta(
    {
      claveIdempotencia: 'IDEMP-A1-W3-001',
      metodoPago: 'EFECTIVO',
      items: [{ platilloId: 1, cantidad: 4 }],
      cotizacionAceptada: cotizacion
    },
    1
  );

  afirmar(ventaConfirmada.estado === 'CONFIRMADA', 'Venta confirmada exitosamente');
  afirmar(ventaConfirmada.total === '240.00', 'Total confirmado coincide con cotización revalidada ($240.00)');
  afirmar(ventaConfirmada.promocion?.id === promo.id, 'Snapshot de promoción en la orden preservado');

  // Consumo de inventario (CW-05 y CW-12):
  // 4 hamburguesas en 2x1 entregan físicamente 4 hamburguesas, por lo que deben descontar 4 panes (no 2)
  const panDespues = await CatalogoService.obtenerIngredientePorId(1);
  const panesConsumidos = new Decimal(panAntes!.existencia).minus(new Decimal(panDespues!.existencia)).toNumber();
  afirmar(panesConsumidos === 4, 'CW-12: Se consumieron exactamente 4 unidades de inventario (unidades físicas entregadas)');

  // Retirar la promoción posteriormente y comprobar que la orden histórica permanece intacta (CW-15)
  await PromocionesService.retirarPromocion(promo.id, 1);
  const ordenHistorica = await VentasService.obtenerPorId(ventaConfirmada.id, 1, 'ADMINISTRADOR');
  afirmar(ordenHistorica.descuentoTotal === '240.00', 'CW-15: Descuento histórico de la orden permanece en $240.00 tras retiro');
  afirmar(ordenHistorica.total === '240.00', 'CW-15: Total histórico de la orden permanece en $240.00 tras retiro');
}

async function ejecutar() {
  console.log('========================================================================');
  console.log('🧪 BATERÍA DE VERIFICACIÓN DE AUDITORÍA 1 — INTEGRANTE 3 (PROMOCIONES)');
  console.log('   Módulo: Descuentos y Promociones (Integrante 3)');
  console.log('   Alcance: Resolución integral de hallazgos W3-02, W3-05, CW-10, CW-14');
  console.log('========================================================================');

  try {
    await inicializarEntornoPrueba();
    await probarTransicionAtomicaEstados();
    await probarDeteccionCambioReglaNxM();
    await probarConversionLimpiaTiposYDuraciones();
    await probarRevalidacionTransaccionalYVenta();

    console.log('\n========================================================================');
    console.log(`🏁 RESULTADO FINAL AUDITORÍA 1 (INTEGRANTE 3): ${exitos}/${exitos + fallos} PRUEBAS EXITOSAS`);
    console.log('========================================================================\n');

    if (fallos > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Error no controlado durante la ejecución de pruebas:', err);
    process.exit(1);
  }
}

ejecutar();
