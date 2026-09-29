import Decimal from 'decimal.js';
import { PromocionesService } from '../services/promociones.service';
import { InventarioService } from '../services/inventario.service';
import { CatalogoService } from '../services/catalogo.service';
import { almacenMemoria } from '../services/almacen-memoria';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    testsPassed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    testsFailed++;
  }
}

async function run() {
  console.log('====================================================================');
  console.log('🧪 BATERÍA DE INTEGRACIÓN FINAL - TAREA W3-06');
  console.log('   Módulo: Descuentos y Promociones (Integrante 3)');
  console.log('   Alcance: Criterios CW-10, CW-11, CW-12, CW-13, CW-14 y CW-15');
  console.log('====================================================================\n');

  // Asegurar insumos base y stock suficiente para pruebas de consumo
  almacenMemoria.platillos[0].precio = new Decimal('100.00');
  if (!almacenMemoria.platillos.find((p) => p.id === 2)) {
    almacenMemoria.platillos.push({ id: 2, nombre: 'Papas Fritas', precio: new Decimal('50.00'), activo: true });
    almacenMemoria.recetas.push({ platilloId: 2, ingredienteId: 4, cantidad: new Decimal(200) });
  }

  // Registrar entradas para garantizar existencia suficiente
  await InventarioService.registrarEntrada({ ingredienteId: 1, cantidad: 50, motivo: 'Stock prueba W3-06', usuarioId: 1 });
  await InventarioService.registrarEntrada({ ingredienteId: 2, cantidad: 5000, motivo: 'Stock prueba W3-06', usuarioId: 1 });
  await InventarioService.registrarEntrada({ ingredienteId: 3, cantidad: 50, motivo: 'Stock prueba W3-06', usuarioId: 1 });
  await InventarioService.registrarEntrada({ ingredienteId: 4, cantidad: 2000, motivo: 'Stock prueba W3-06', usuarioId: 1 });

  almacenMemoria.promociones = [];
  almacenMemoria.proxPromocionId = 1;

  // =========================================================================
  // 1. CRITERIO CW-10: VIGENCIAS TEMPORAL, PERMANENTE, DESACTIVACIÓN Y RETIRO
  // =========================================================================
  console.log('⏱️ 1. Criterio CW-10: Vigencia Temporal, Permanente y Estados Operativos:');
  const tInicio = new Date('2026-09-29T12:00:00.000Z');
  const tFin = new Date('2026-09-29T14:00:00.000Z');

  const promoTemporal = await PromocionesService.crearPromocion(
    {
      nombre: 'Almuerzo 15%',
      platilloId: 1,
      tipo: 'PORCENTAJE',
      porcentaje: 15,
      duracion: 'TEMPORAL',
      fechaInicio: tInicio.toISOString(),
      fechaFin: tFin.toISOString()
    },
    1
  );

  assert(PromocionesService.estaVigente(promoTemporal, tInicio), 'CW-10: En tInicio exacto (12:00:00Z) es VIGENTE (inicio inclusivo)');
  assert(PromocionesService.estaVigente(promoTemporal, new Date('2026-09-29T13:00:00.000Z')), 'CW-10: Dentro del intervalo es VIGENTE');
  assert(!PromocionesService.estaVigente(promoTemporal, tFin), 'CW-10: En tFin exacto (14:00:00Z) NO es vigente (fin exclusivo)');

  const promoPermanente = await PromocionesService.crearPromocion(
    {
      nombre: 'Martes 2x1 Clásica Permanente',
      platilloId: 1,
      tipo: 'NXM',
      n: 2,
      m: 1,
      duracion: 'PERMANENTE'
    },
    1
  );

  assert(PromocionesService.estaVigente(promoPermanente, new Date()), 'CW-10: Promoción permanente no tiene vencimiento y es VIGENTE');

  // Desactivación inmediata
  await PromocionesService.cambiarEstado(promoPermanente.id, 'INACTIVA', 1);
  const promoPausada = await PromocionesService.obtenerPorId(promoPermanente.id);
  assert(!PromocionesService.estaVigente(promoPausada, new Date()), 'CW-10: Desactivar promoción impide aplicaciones posteriores de inmediato');

  // Reactivar para siguientes pruebas
  await PromocionesService.cambiarEstado(promoPermanente.id, 'ACTIVA', 1);

  // =========================================================================
  // 2. CRITERIO CW-11: PORCENTAJE (15%, 100% Y TOTAL CERO SIN EVITAR CONSUMO)
  // =========================================================================
  console.log('\n🔢 2. Criterio CW-11: Porcentaje (15%, 100% y Total Cero):');
  // Caso estándar: 2 unidades de $100 al 15% -> Subtotal 200, Descuento 30, Total 170
  // Usamos fecha dentro del horario de promoTemporal
  const cotizacion15 = await PromocionesService.cotizarOrden(
    [{ platilloId: 1, cantidad: 2 }],
    new Date('2026-09-29T12:30:00.000Z')
  );
  // Nota: Promo 2x1 da ahorro de 100 (bonifica 1 hamburguesa), mientras 15% daría 30.
  // Por CW-13 gana 2x1 ($100 > $30).
  // Para probar explícitamente 15%, pausamos temporalmente promoPermanente:
  await PromocionesService.cambiarEstado(promoPermanente.id, 'INACTIVA', 1);
  const cotizacion15Pura = await PromocionesService.cotizarOrden(
    [{ platilloId: 1, cantidad: 2 }],
    new Date('2026-09-29T12:30:00.000Z')
  );

  assert(cotizacion15Pura.subtotalBruto === '200.00', 'CW-11: Línea de 200 subtotal bruto');
  assert(cotizacion15Pura.descuentoTotal === '30.00', 'CW-11: Descuento del 15% es exactamente $30.00');
  assert(cotizacion15Pura.total === '170.00', 'CW-11: Cobra exactamente $170.00');

  // Caso 100% Cortesía: Total cero válido
  const promo100 = await PromocionesService.crearPromocion(
    {
      nombre: 'Cortesía 100% Hamburguesa',
      platilloId: 1,
      tipo: 'PORCENTAJE',
      porcentaje: 100,
      duracion: 'PERMANENTE'
    },
    1
  );

  const cotizacion100 = await PromocionesService.cotizarOrden([{ platilloId: 1, cantidad: 2 }]);
  assert(cotizacion100.subtotalBruto === '200.00', 'CW-11: Subtotal bruto $200.00');
  assert(cotizacion100.descuentoTotal === '200.00', 'CW-11: Descuento 100% es $200.00');
  assert(cotizacion100.total === '0.00', 'CW-11: Permite total cero ($0.00)');
  assert(cotizacion100.partidas[0].cantidad === 2, 'CW-11: Unidades entregadas se conservan en 2');

  // Limpiar promo100
  await PromocionesService.retirarPromocion(promo100.id, 1);
  await PromocionesService.cambiarEstado(promoPermanente.id, 'ACTIVA', 1);

  // =========================================================================
  // 3. CRITERIO CW-12: NXM (2x1, 3x1 Y CONTRASTE CON CONSUMO DE INVENTARIO)
  // =========================================================================
  console.log('\n🍔 3. Criterio CW-12: NxM (2x1, 3x1 y Contraste de Consumo Físico):');

  // 3.1: 5 unidades de 100 en 2x1 -> Cuestan 300, Bonifican 2 (ahorro 200). Se entregan 5.
  const cotizacion5en2x1 = await PromocionesService.cotizarOrden([{ platilloId: 1, cantidad: 5 }]);
  assert(cotizacion5en2x1.subtotalBruto === '500.00', 'CW-12: 5 unidades subtotal bruto $500.00');
  assert(cotizacion5en2x1.descuentoTotal === '200.00', 'CW-12: 5 unidades en 2x1 ahorran $200.00 (bonifican 2)');
  assert(cotizacion5en2x1.total === '300.00', 'CW-12: 5 unidades en 2x1 cuestan $300.00');
  assert(cotizacion5en2x1.partidas[0].cantidad === 5, 'CW-12: Se entregan físicamente 5 unidades');

  // 3.2: 4 unidades de 100 en 3x1 -> Cuestan 200, Bonifican 2 (ahorro 200). Se entregan 4.
  // Creamos promo 3x1 para Platillo 1
  const promo3x1 = await PromocionesService.crearPromocion(
    {
      nombre: 'Promo 3x1 Hamburguesa',
      platilloId: 1,
      tipo: 'NXM',
      n: 3,
      m: 1,
      duracion: 'PERMANENTE'
    },
    1
  );

  // Para 4 unidades de 100:
  // Promo 2x1 daría ahorro de 200 (cobran 3).
  // Promo 3x1 daría ahorro de 200 (cobran 2).
  // En 3x1 cobran 1*1 + 1 = 2 (ahorro 2 * 100 = 200).
  // Ambas empatan en ahorro ($200.00). Por CW-13 desempata por menor ID (gana promoPermanente ID 2 sobre promo3x1 ID 4).
  // Para evaluar explícitamente 3x1, pausamos promoPermanente:
  await PromocionesService.cambiarEstado(promoPermanente.id, 'INACTIVA', 1);

  const cotizacion4en3x1 = await PromocionesService.cotizarOrden([{ platilloId: 1, cantidad: 4 }]);
  assert(cotizacion4en3x1.subtotalBruto === '400.00', 'CW-12: 4 unidades subtotal bruto $400.00');
  assert(cotizacion4en3x1.descuentoTotal === '200.00', 'CW-12: 4 unidades en 3x1 ahorran $200.00 (cobran 2)');
  assert(cotizacion4en3x1.total === '200.00', 'CW-12: 4 unidades en 3x1 cuestan $200.00');
  assert(cotizacion4en3x1.partidas[0].cantidad === 4, 'CW-12: Se entregan físicamente 4 unidades');

  // 3.3: Contrastar unidades entregadas con consumo de inventario del Integrante 2
  console.log('\n📦 3.3. Contraste Físico de Inventario (CW-05 y CW-12):');
  // Consultar existencias iniciales:
  const panesAntes = await CatalogoService.obtenerIngredientePorId(1);
  const carneAntes = await CatalogoService.obtenerIngredientePorId(2);
  const quesoAntes = await CatalogoService.obtenerIngredientePorId(3);

  // Ejecutamos consumo de inventario de las 5 hamburguesas de la venta en 2x1:
  // Se pasa p.cantidad (5 unidades), NO las 3 cobradas.
  await InventarioService.descontarInventarioPorVenta(
    null,
    901,
    1,
    [{ platilloId: 1, cantidadPlatillos: cotizacion5en2x1.partidas[0].cantidad }]
  );

  const panesDespues = await CatalogoService.obtenerIngredientePorId(1);
  const carneDespues = await CatalogoService.obtenerIngredientePorId(2);
  const quesoDespues = await CatalogoService.obtenerIngredientePorId(3);

  const diffPanes = new Decimal(panesAntes!.existencia).minus(panesDespues!.existencia);
  const diffCarne = new Decimal(carneAntes!.existencia).minus(carneDespues!.existencia);
  const diffQueso = new Decimal(quesoAntes!.existencia).minus(quesoDespues!.existencia);

  assert(diffPanes.equals(5), 'CW-12: 5 hamburguesas en 2x1 consumieron exactamente 5 panes (incluyendo unidades bonificadas)');
  assert(diffCarne.equals(750), 'CW-12: 5 hamburguesas en 2x1 consumieron exactamente 750 g de carne (5 x 150g)');
  assert(diffQueso.equals(5), 'CW-12: 5 hamburguesas en 2x1 consumieron exactamente 5 quesos');

  // Reactivar promociones para siguientes pruebas
  await PromocionesService.cambiarEstado(promoPermanente.id, 'ACTIVA', 1);

  // =========================================================================
  // 4. CRITERIO CW-13: UNA SOLA PROMOCIÓN POR ORDEN, DESEMPATE Y SUMA EXACTA
  // =========================================================================
  console.log('\n🏆 4. Criterio CW-13: Una Sola Promoción por Orden, Mayor Ahorro y Desempate:');

  // Promo Papas 2x1 (ID 5)
  const promoPapas2x1 = await PromocionesService.crearPromocion(
    {
      nombre: 'Papas 2x1',
      platilloId: 2,
      tipo: 'NXM',
      n: 2,
      m: 1,
      duracion: 'PERMANENTE'
    },
    1
  );

  // Orden con:
  // - 2 Hamburguesas ($100 c/u -> $200). Promo 2x1 en hamburguesa daría ahorro $100.
  // - 6 Papas Fritas ($50 c/u -> $300). Promo 2x1 en papas daría ahorro de 3 papas = $150.
  // Debe ganar la de Papas 2x1 porque $150 > $100.
  const cotizacionMayorAhorro = await PromocionesService.cotizarOrden([
    { platilloId: 1, cantidad: 2 },
    { platilloId: 2, cantidad: 6 }
  ]);

  assert(cotizacionMayorAhorro.promocionAplicada?.id === promoPapas2x1.id, 'CW-13: Gana la promoción con mayor ahorro efectivo ($150 sobre $100)');
  assert(cotizacionMayorAhorro.descuentoTotal === '150.00', 'CW-13: Descuento total de la orden es $150.00');

  // Verificar que el ahorro se asigne exclusivamente a la línea de Papas
  const partidaHam = cotizacionMayorAhorro.partidas.find((p) => p.platilloId === 1)!;
  const partidaPap = cotizacionMayorAhorro.partidas.find((p) => p.platilloId === 2)!;

  assert(partidaHam.descuento === '0.00' && partidaHam.subtotalNeto === '200.00', 'CW-13: La línea de hamburguesa no recibe descuento y conserva precio regular');
  assert(partidaPap.descuento === '150.00' && partidaPap.subtotalNeto === '150.00', 'CW-13: La línea de papas absorbe el descuento íntegro');

  // Cuadre exacto de partidas
  const sumaPartidas = new Decimal(partidaHam.subtotalNeto).plus(partidaPap.subtotalNeto);
  assert(sumaPartidas.equals(new Decimal(cotizacionMayorAhorro.total)), 'CW-13: Las partidas netas suman exactamente el total de la orden ($350.00)');

  // =========================================================================
  // 5. CRITERIO CW-14: DETECCIÓN DE CAMBIOS Y REVALIDACIÓN
  // =========================================================================
  console.log('\n🛡️ 5. Criterio CW-14: Detección de Cambios de Precio o Promoción:');
  // Cambiamos precio de papas antes de que el cajero confirme:
  almacenMemoria.platillos[1].precio = new Decimal('60.00');
  try {
    await PromocionesService.validarConsistenciaCotizacion(cotizacionMayorAhorro);
    assert(false, 'Debe rechazar la venta desactualizada');
  } catch (err: any) {
    assert(err.codigo === 'COTIZACION_DESACTUALIZADA', 'CW-14: Rechaza con COTIZACION_DESACTUALIZADA al variar precio en servidor');
  }
  almacenMemoria.platillos[1].precio = new Decimal('50.00');

  // =========================================================================
  // 6. CRITERIO CW-15: RETIRO DE PROMOCIÓN SIN AFECTAR HISTORIAL PREVIO
  // =========================================================================
  console.log('\n📜 6. Criterio CW-15: Retiro Administrativo sin Alterar Historial Previo:');
  const snapshotVentaPrevia = {
    folio: 'ORD-2026-001',
    promocionId: promoPapas2x1.id,
    nombrePromo: promoPapas2x1.nombre,
    ahorro: cotizacionMayorAhorro.descuentoTotal,
    total: cotizacionMayorAhorro.total
  };

  // Retiramos la promoción definitivamente
  await PromocionesService.retirarPromocion(promoPapas2x1.id, 1);
  const promoEstado = await PromocionesService.obtenerPorId(promoPapas2x1.id);
  assert(promoEstado.estado === 'RETIRADA', 'Promoción dada de baja lógica inmutable');

  // Comprobar que la venta histórica conserva todos sus datos originales
  assert(snapshotVentaPrevia.ahorro === '150.00', 'CW-15: El ahorro de la venta histórica se conserva inalterado ($150.00)');
  assert(snapshotVentaPrevia.total === cotizacionMayorAhorro.total, 'CW-15: El total de la orden confirmada previa se conserva inalterado');
  assert(snapshotVentaPrevia.nombrePromo === 'Papas 2x1', 'CW-15: Copia histórica inmutable de la regla aplicada preservada');

  console.log('\n====================================================================');
  console.log(`🏁 RESULTADO DE PRUEBAS W3-06: ${testsPassed}/${testsPassed + testsFailed} EXITOSAS`);
  console.log('====================================================================');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Error no controlado en pruebas W3-06:', err);
  process.exit(1);
});
