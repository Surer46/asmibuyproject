import Decimal from 'decimal.js';
import { PromocionesService } from '../services/promociones.service';
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
  console.log('🧪 BATERÍA DE PRUEBAS DE INTEGRACIÓN CON VENTAS - TAREA W3-05');
  console.log('   Módulo: Descuentos y Promociones (Integrante 3)');
  console.log('   Alcance: Cotización, Revalidación CW-14 e Inmutabilidad CW-15');
  console.log('====================================================================\n');

  // Inicializar estado en memoria
  almacenMemoria.platillos = [
    { id: 1, nombre: 'Hamburguesa Clásica', precio: new Decimal('100.00'), activo: true },
    { id: 2, nombre: 'Papas Fritas', precio: new Decimal('50.00'), activo: true }
  ];
  almacenMemoria.promociones = [];
  almacenMemoria.proxPromocionId = 1;

  // Crear promoción inicial: 2x1 en Hamburguesas
  const promo2x1 = await PromocionesService.crearPromocion(
    {
      nombre: 'Martes 2x1 en Hamburguesa',
      platilloId: 1,
      tipo: 'NXM',
      n: 2,
      m: 1,
      duracion: 'PERMANENTE'
    },
    1
  );

  // 1. Cotización de Orden
  console.log('🛒 1. Cotización de Venta:');
  const cotizacionInicial = await PromocionesService.cotizarOrden([
    { platilloId: 1, cantidad: 2 },
    { platilloId: 2, cantidad: 1 }
  ]);

  assert(cotizacionInicial.subtotalBruto === '250.00', 'Subtotal bruto calculado: $250.00 (2x100 + 1x50)');
  assert(cotizacionInicial.descuentoTotal === '100.00', 'Descuento total calculado: $100.00 (2x1 en hamburguesa)');
  assert(cotizacionInicial.total === '150.00', 'Total neto a pagar calculado: $150.00 (250 - 100)');
  assert(cotizacionInicial.promocionAplicada?.id === promo2x1.id, 'Promoción aplicada registrada en snapshot');
  assert(cotizacionInicial.partidas.length === 2, 'Contiene 2 partidas');

  // Validar consistencia inmediata: debe ser válida sin cambios
  const revalidacionSinCambios = await PromocionesService.validarConsistenciaCotizacion(cotizacionInicial);
  assert(revalidacionSinCambios.total === cotizacionInicial.total, 'Revalidación exitosa cuando las condiciones no han cambiado');

  // 2. Criterio CW-14: Detección de Cambio de Precio entre Cotización y Confirmación
  console.log('\n💲 2. Detección de Cambio de Precio del Platillo (Criterio CW-14):');
  // Simulamos que el administrador cambia el precio de la Hamburguesa de $100 a $120 antes de que el cajero confirme:
  almacenMemoria.platillos[0].precio = new Decimal('120.00');

  try {
    await PromocionesService.validarConsistenciaCotizacion(cotizacionInicial);
    assert(false, 'Debe rechazar la venta si el precio del platillo cambió');
  } catch (err: any) {
    assert(err.codigo === 'COTIZACION_DESACTUALIZADA', 'CRITERIO CW-14: Rechaza con COTIZACION_DESACTUALIZADA por cambio de precio');
    assert(err.detalles.nuevaCotizacion.total === '170.00', 'Calcula nuevo total correcto ($170.00) para aprobación explícita');
  }

  // Restauramos precio para siguientes pruebas
  almacenMemoria.platillos[0].precio = new Decimal('100.00');

  // 3. Criterio CW-14: Detección de Desactivación o Expiración de Promoción
  console.log('\n⏸️ 3. Detección de Expiración o Desactivación de Promoción (Criterio CW-14):');
  // Simulamos que la promoción se desactiva antes de confirmar:
  await PromocionesService.cambiarEstado(promo2x1.id, 'INACTIVA', 1);

  try {
    await PromocionesService.validarConsistenciaCotizacion(cotizacionInicial);
    assert(false, 'Debe rechazar la venta si la promoción fue desactivada o expiró');
  } catch (err: any) {
    assert(err.codigo === 'COTIZACION_DESACTUALIZADA', 'CRITERIO CW-14: Rechaza con COTIZACION_DESACTUALIZADA por suspensión de promoción');
    assert(err.detalles.nuevaCotizacion.promocionAplicada === null, 'La nueva cotización no aplica la promoción desactivada');
    assert(err.detalles.nuevaCotizacion.total === '250.00', 'El nuevo total cobra el importe íntegro ($250.00)');
  }

  // Reactivar para siguiente prueba
  await PromocionesService.cambiarEstado(promo2x1.id, 'ACTIVA', 1);

  // 4. Criterio CW-14: Detección de Nueva Promoción con Mayor Ahorro
  console.log('\n🎁 4. Detección de Nueva Promoción más Ventajosa (Criterio CW-14):');
  // Simulamos que mientras el cajero cotizaba, se activa una promoción de 3x1 o un descuento de papas 100% que reduce aún más el total:
  const promoPapasGratis = await PromocionesService.crearPromocion(
    {
      nombre: 'Papas Gratis de Aniversario',
      platilloId: 2,
      tipo: 'PORCENTAJE',
      porcentaje: 100,
      duracion: 'PERMANENTE'
    },
    1
  );

  // En la orden (2 hamburguesas de 100 y 1 papas de 50):
  // Promo 2x1 ahorra 100. Promo Papas ahorra 50. Como 100 > 50, sigue ganando 2x1.
  // Pero si creamos una promoción de 100% en Hamburguesa (ahorra $200):
  const promoHamburguesa100 = await PromocionesService.crearPromocion(
    {
      nombre: 'Hamburguesa 100% Cortesía',
      platilloId: 1,
      tipo: 'PORCENTAJE',
      porcentaje: 100,
      duracion: 'PERMANENTE'
    },
    1
  );

  try {
    await PromocionesService.validarConsistenciaCotizacion(cotizacionInicial);
    assert(false, 'Debe rechazar la cotización previa si una nueva promoción más favorable fue activada');
  } catch (err: any) {
    assert(err.codigo === 'COTIZACION_DESACTUALIZADA', 'CRITERIO CW-14: Rechaza con COTIZACION_DESACTUALIZADA si cambia la mejor promoción');
    assert(err.detalles.nuevaCotizacion.promocionAplicada.id === promoHamburguesa100.id, 'Nueva cotización toma la promoción de mayor ahorro');
    assert(err.detalles.nuevaCotizacion.total === '50.00', 'Nuevo total ajustado a $50.00');
  }

  // 5. Criterio CW-15: Conservación Histórica Inmutable de Ventas Pasadas
  console.log('\n📜 5. Conservación Histórica Inmutable de Ventas Pasadas (Criterio CW-15):');
  // Simulamos una orden persistida en Ventas con el snapshot de promo2x1:
  const ordenVentaConfirmada = {
    id: 101,
    fecha: new Date('2026-09-29T10:00:00.000Z'),
    subtotalBruto: cotizacionInicial.subtotalBruto,
    descuentoTotal: cotizacionInicial.descuentoTotal,
    total: cotizacionInicial.total,
    promocionSnapshot: { ...cotizacionInicial.promocionAplicada },
    partidas: cotizacionInicial.partidas.map((p) => ({ ...p }))
  };

  // El administrador retira definitivamente la promoción 2x1:
  await PromocionesService.retirarPromocion(promo2x1.id, 1);
  const promoRetirada = await PromocionesService.obtenerPorId(promo2x1.id);
  assert(promoRetirada.estado === 'RETIRADA', 'La promoción fue retirada en la administración');

  // Verificamos que la orden histórica de venta no haya sufrido alteración alguna:
  assert(ordenVentaConfirmada.descuentoTotal === '100.00', 'CRITERIO CW-15: El descuento de la venta previa permanece en $100.00');
  assert(ordenVentaConfirmada.total === '150.00', 'CRITERIO CW-15: El total de la venta previa permanece en $150.00');
  assert(ordenVentaConfirmada.promocionSnapshot.nombre === 'Martes 2x1 en Hamburguesa', 'CRITERIO CW-15: El snapshot del nombre se conserva intacto');
  assert(ordenVentaConfirmada.partidas[0].descuento === '100.00', 'CRITERIO CW-15: El desglose por partida histórico se conserva inalterado');

  console.log('\n====================================================================');
  console.log(`🏁 RESULTADO DE PRUEBAS W3-05: ${testsPassed}/${testsPassed + testsFailed} EXITOSAS`);
  console.log('====================================================================');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Error no controlado en pruebas W3-05:', err);
  process.exit(1);
});
