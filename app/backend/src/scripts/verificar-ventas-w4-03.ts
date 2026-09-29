import Decimal from 'decimal.js';
import { VentasService } from '../services/ventas.service';
import { PromocionesService } from '../services/promociones.service';
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
  console.log('🧪 BATERÍA DE PRUEBAS DE VENTA Y CONSUMO DE STOCK - TAREA W4-03');
  console.log('   Módulo: Punto de Venta e Historial (Integrante 4)');
  console.log('   Alcance: Consumo CW-05, Atomicidad CW-06, Idempotencia CW-07, Revalidación CW-14');
  console.log('====================================================================\n');

  // Inicializar estado en memoria
  almacenMemoria.ingredientes = [
    { id: 1, nombre: 'Pan de Hamburguesa', unidad: 'pieza', minimo: new Decimal(10), activo: true },
    { id: 2, nombre: 'Carne de Res', unidad: 'g', minimo: new Decimal(1000), activo: true },
    { id: 3, nombre: 'Queso Amarillo', unidad: 'pieza', minimo: new Decimal(5), activo: true }
  ];
  almacenMemoria.platillos = [
    { id: 1, nombre: 'Hamburguesa Clásica', precio: new Decimal('120.00'), activo: true }
  ];
  // Receta: 1 Pan, 150g Carne, 1 Queso
  almacenMemoria.recetas = [
    { platilloId: 1, ingredienteId: 1, cantidad: new Decimal(1) },
    { platilloId: 1, ingredienteId: 2, cantidad: new Decimal(150) },
    { platilloId: 1, ingredienteId: 3, cantidad: new Decimal(1) }
  ];
  // Stock inicial: 10 panes, 1500g carne, 10 quesos (alcanza para exactamente 10 hamburguesas)
  almacenMemoria.movimientos = [
    { id: 1, ingredienteId: 1, tipo: 'ENTRADA', cantidad: new Decimal(10), motivo: 'Stock inicial', usuarioId: 1, creadoEn: new Date() },
    { id: 2, ingredienteId: 2, tipo: 'ENTRADA', cantidad: new Decimal(1500), motivo: 'Stock inicial', usuarioId: 1, creadoEn: new Date() },
    { id: 3, ingredienteId: 3, tipo: 'ENTRADA', cantidad: new Decimal(10), motivo: 'Stock inicial', usuarioId: 1, creadoEn: new Date() }
  ];
  almacenMemoria.promociones = [];
  almacenMemoria.ordenes = [];
  almacenMemoria.ordenDetalles = [];
  almacenMemoria.proxMovimientoId = 4;
  almacenMemoria.proxOrdenId = 1;
  almacenMemoria.proxOrdenDetalleId = 1;

  // 1. Venta Regular sin Promoción y Consumo de Stock (Criterio CW-05)
  console.log('🍔 1. Venta Regular y Consumo Exacto de Inventario (CW-05):');
  const cotizacion1 = await PromocionesService.cotizarOrden([{ platilloId: 1, cantidad: 2 }]);
  assert(cotizacion1.total === '240.00', 'Cotización correcta para 2 hamburguesas: $240.00');

  const orden1 = await VentasService.confirmarVenta(
    {
      claveIdempotencia: 'uuid-venta-001',
      metodoPago: 'EFECTIVO',
      items: [{ platilloId: 1, cantidad: 2 }],
      cotizacionAceptada: cotizacion1
    },
    2 // Usuario Cajero
  );

  assert(orden1.folio === 'ORD-00001', 'Folio generado secuencialmente: ORD-00001');
  assert(orden1.estado === 'CONFIRMADA', 'Estado de la orden es CONFIRMADA');
  assert(orden1.total === '240.00', 'Total registrado es $240.00');
  assert(orden1.partidas.length === 1, 'Tiene 1 partida de detalle');
  assert(orden1.partidas[0].cantidad === 2, 'Partida registra 2 unidades físicas');

  // Verificar consumo en inventario:
  const saldoPan = almacenMemoria.movimientos.filter((m) => m.ingredienteId === 1).reduce((acc, m) => acc.plus(m.cantidad), new Decimal(0));
  const saldoCarne = almacenMemoria.movimientos.filter((m) => m.ingredienteId === 2).reduce((acc, m) => acc.plus(m.cantidad), new Decimal(0));
  const saldoQueso = almacenMemoria.movimientos.filter((m) => m.ingredienteId === 3).reduce((acc, m) => acc.plus(m.cantidad), new Decimal(0));

  assert(saldoPan.equals(8), 'Pan restante: 8 piezas (10 - 2)');
  assert(saldoCarne.equals(1200), 'Carne restante: 1200 g (1500 - 300)');
  assert(saldoQueso.equals(8), 'Queso restante: 8 piezas (10 - 2)');

  // 2. Idempotencia y Recuperación de Respuesta Incierta (Criterio CW-07)
  console.log('\n🔁 2. Idempotencia y Respuesta Perdida (Criterio CW-07):');
  // Reintento con la misma clave idempotente y mismo contenido
  const ordenReintento = await VentasService.confirmarVenta(
    {
      claveIdempotencia: 'uuid-venta-001',
      metodoPago: 'EFECTIVO',
      items: [{ platilloId: 1, cantidad: 2 }],
      cotizacionAceptada: cotizacion1
    },
    2
  );

  assert(ordenReintento.id === orden1.id, 'Idempotencia: Devuelve la misma orden sin duplicar');
  assert(ordenReintento.folio === orden1.folio, 'Folio coincide exactamente con el original');
  assert(almacenMemoria.ordenes.length === 1, 'No se creó una segunda orden en la base de datos');

  // Verificar que NO se volvió a descontar inventario
  const saldoPan2 = almacenMemoria.movimientos.filter((m) => m.ingredienteId === 1).reduce((acc, m) => acc.plus(m.cantidad), new Decimal(0));
  assert(saldoPan2.equals(8), 'El saldo de inventario no fue descontado dos veces (sigue en 8)');

  // Reintento con la misma clave pero diferente contenido debe fallar
  try {
    await VentasService.confirmarVenta(
      {
        claveIdempotencia: 'uuid-venta-001',
        metodoPago: 'EFECTIVO',
        items: [{ platilloId: 1, cantidad: 3 }], // diferente cantidad
        cotizacionAceptada: { ...cotizacion1, total: '360.00' }
      },
      2
    );
    assert(false, 'Debe rechazar la solicitud si la clave de idempotencia se reutiliza para diferente contenido');
  } catch (err: any) {
    assert(err.codigo === 'IDEMPOTENCIA_CONFLICTO', 'Rechaza con IDEMPOTENCIA_CONFLICTO ante colisión de contenido');
  }

  // 3. Venta con Promoción NxM y Consumo de Unidades Bonificadas (Criterios CW-05 y CW-12)
  console.log('\n🎁 3. Venta con Promoción 2x1 y Consumo de Unidades Bonificadas (CW-05 / CW-12):');
  // Creamos promoción 2x1
  const promo2x1 = await PromocionesService.crearPromocion(
    {
      nombre: 'Promo 2x1 Hamburguesas',
      platilloId: 1,
      tipo: 'NXM',
      n: 2,
      m: 1,
      duracion: 'PERMANENTE'
    },
    1
  );

  const cotizacion2 = await PromocionesService.cotizarOrden([{ platilloId: 1, cantidad: 2 }]);
  assert(cotizacion2.subtotalBruto === '240.00', 'Subtotal bruto: $240.00');
  assert(cotizacion2.descuentoTotal === '120.00', 'Descuento total: $120.00 (2x1)');
  assert(cotizacion2.total === '120.00', 'Total neto: $120.00');
  assert(cotizacion2.partidas[0].unidadesCobradas === 1, '1 unidad cobrada');
  assert(cotizacion2.partidas[0].unidadesBonificadas === 1, '1 unidad bonificada');

  const orden2 = await VentasService.confirmarVenta(
    {
      claveIdempotencia: 'uuid-venta-002',
      metodoPago: 'EFECTIVO',
      items: [{ platilloId: 1, cantidad: 2 }],
      cotizacionAceptada: cotizacion2
    },
    2
  );

  assert(orden2.folio === 'ORD-00002', 'Folio generado: ORD-00002');
  assert(orden2.promocion?.nombre === 'Promo 2x1 Hamburguesas', 'Snapshot de promoción registrado');
  assert(orden2.total === '120.00', 'Total de la orden con descuento es $120.00');

  // Criterio CW-05 / CW-12: Las 2 unidades físicas (1 cobrada + 1 bonificada) consumen pan, carne y queso completos:
  const saldoPan3 = almacenMemoria.movimientos.filter((m) => m.ingredienteId === 1).reduce((acc, m) => acc.plus(m.cantidad), new Decimal(0));
  const saldoCarne3 = almacenMemoria.movimientos.filter((m) => m.ingredienteId === 2).reduce((acc, m) => acc.plus(m.cantidad), new Decimal(0));
  assert(saldoPan3.equals(6), 'Pan restante: 6 piezas (8 - 2 consumidas por 2x1)');
  assert(saldoCarne3.equals(900), 'Carne restante: 900 g (1200 - 300 consumidas por 2x1)');

  // 4. Fallo por Stock Insuficiente y Rollback Atómico (Criterio CW-06)
  console.log('\n🛑 4. Demanda Insuficiente y Rollback Atómico (Criterio CW-06):');
  // Actualmente quedan 6 panes y 900g de carne (alcanza para 6 hamburguesas).
  // Si intentamos vender 7 hamburguesas, la demanda es de 7 panes y 1050g carne:
  const cotizacionInsuficiente = await PromocionesService.cotizarOrden([{ platilloId: 1, cantidad: 7 }]);
  const ordenesAntes = almacenMemoria.ordenes.length;
  const movimientosAntes = almacenMemoria.movimientos.length;

  try {
    await VentasService.confirmarVenta(
      {
        claveIdempotencia: 'uuid-venta-003',
        metodoPago: 'EFECTIVO',
        items: [{ platilloId: 1, cantidad: 7 }],
        cotizacionAceptada: cotizacionInsuficiente
      },
      2
    );
    assert(false, 'Debe rechazar la venta si no hay stock suficiente');
  } catch (err: any) {
    assert(err.codigo === 'STOCK_INSUFICIENTE', 'Lanza STOCK_INSUFICIENTE ante stock insuficiente');
    assert(err.statusCode === 409, 'Código HTTP es 409 Conflicto');
  }

  // Verificamos que no se persistió nada (Atomicidad / Rollback)
  assert(almacenMemoria.ordenes.length === ordenesAntes, 'No se insertó la orden en la base de datos');
  assert(almacenMemoria.movimientos.length === movimientosAntes, 'No se generaron movimientos de consumo parciales');
  const saldoPanRollback = almacenMemoria.movimientos.filter((m) => m.ingredienteId === 1).reduce((acc, m) => acc.plus(m.cantidad), new Decimal(0));
  assert(saldoPanRollback.equals(6), 'El saldo de inventario se conserva intacto en 6');

  // 5. Revalidación Económica CW-14 (Cambio de Precio entre Cotización y Confirmación)
  console.log('\n💲 5. Revalidación Económica ante Modificación Administrativa (CW-14):');
  // Se cotiza 1 hamburguesa a $120.00
  const cotizacionPrevia = await PromocionesService.cotizarOrden([{ platilloId: 1, cantidad: 1 }]);
  // Administrador altera el precio en caliente a $150.00
  almacenMemoria.platillos[0].precio = new Decimal('150.00');

  try {
    await VentasService.confirmarVenta(
      {
        claveIdempotencia: 'uuid-venta-004',
        metodoPago: 'EFECTIVO',
        items: [{ platilloId: 1, cantidad: 1 }],
        cotizacionAceptada: cotizacionPrevia
      },
      2
    );
    assert(false, 'Debe rechazar la venta si el precio del platillo fue actualizado');
  } catch (err: any) {
    assert(err.codigo === 'COTIZACION_DESACTUALIZADA', 'CW-14: Rechaza con COTIZACION_DESACTUALIZADA');
    assert(err.detalles.nuevaCotizacion.total === '150.00', 'Calcula y retorna la nueva cotización ($150.00) para reaceptación');
  }

  // Restauramos precio
  almacenMemoria.platillos[0].precio = new Decimal('120.00');

  // 6. Validación de Método de Pago para Total $0.00 (SIN_COBRO)
  console.log('\n💳 6. Validación de Métodos de Pago:');
  const promo100 = await PromocionesService.crearPromocion(
    {
      nombre: 'Promo 100% Gratis',
      platilloId: 1,
      tipo: 'PORCENTAJE',
      porcentaje: 100,
      duracion: 'PERMANENTE'
    },
    1
  );

  const cotizacionGratis = await PromocionesService.cotizarOrden([{ platilloId: 1, cantidad: 1 }]);
  assert(cotizacionGratis.total === '0.00', 'Total cotizado es $0.00 con promo 100%');

  // Intentar pagar con EFECTIVO una orden de $0.00 debe ser rechazado
  try {
    await VentasService.confirmarVenta(
      {
        claveIdempotencia: 'uuid-venta-005',
        metodoPago: 'EFECTIVO',
        items: [{ platilloId: 1, cantidad: 1 }],
        cotizacionAceptada: cotizacionGratis
      },
      2
    );
    assert(false, 'Debe rechazar EFECTIVO si el total es $0.00');
  } catch (err: any) {
    assert(err.codigo === 'METODO_PAGO_INVALIDO', 'Rechaza con METODO_PAGO_INVALIDO');
  }

  // Confirmar con SIN_COBRO debe tener éxito y consumir stock
  const ordenGratis = await VentasService.confirmarVenta(
    {
      claveIdempotencia: 'uuid-venta-005',
      metodoPago: 'SIN_COBRO',
      items: [{ platilloId: 1, cantidad: 1 }],
      cotizacionAceptada: cotizacionGratis
    },
    2
  );

  assert(ordenGratis.total === '0.00', 'Orden registrada con total $0.00');
  assert(ordenGratis.metodoPago === 'SIN_COBRO', 'Método de pago registrado como SIN_COBRO');
  const saldoPanPostGratis = almacenMemoria.movimientos.filter((m) => m.ingredienteId === 1).reduce((acc, m) => acc.plus(m.cantidad), new Decimal(0));
  assert(saldoPanPostGratis.equals(5), 'Consumió 1 pan a pesar de ser gratuita ($0.00)');

  console.log('\n====================================================================');
  console.log(`🏁 RESULTADO DE PRUEBAS W4-03: ${testsPassed}/${testsPassed + testsFailed} EXITOSAS`);
  console.log('====================================================================');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Error no controlado en pruebas W4-03:', err);
  process.exit(1);
});
