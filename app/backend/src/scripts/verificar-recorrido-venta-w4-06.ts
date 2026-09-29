import Decimal from 'decimal.js';
import { VentasService } from '../services/ventas.service';
import { PromocionesService } from '../services/promociones.service';
import { CatalogoService } from '../services/catalogo.service';
import { InventarioService } from '../services/inventario.service';
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
  console.log('================================================================================');
  console.log('🧪 VERIFICACIÓN INTEGRAL DE RECORRIDO DE VENTA - TAREA W4-06');
  console.log('   Módulo: Punto de Venta e Historial (Integrante 4)');
  console.log('   Alcance: Flujo Completo, Competencia de Stock, Doble Clic, Respuesta Perdida');
  console.log('================================================================================\n');

  // Inicializar estado en memoria in-place para preservar referencias
  almacenMemoria.ingredientes.length = 0;
  almacenMemoria.ingredientes.push(
    { id: 1, nombre: 'Pan de Hamburguesa', unidad: 'pieza', minimo: new Decimal(10), activo: true },
    { id: 2, nombre: 'Carne de Res', unidad: 'g', minimo: new Decimal(1000), activo: true },
    { id: 3, nombre: 'Queso Amarillo', unidad: 'pieza', minimo: new Decimal(5), activo: true }
  );

  almacenMemoria.platillos.length = 0;
  almacenMemoria.platillos.push(
    { id: 1, nombre: 'Hamburguesa Clásica', precio: new Decimal('120.00'), activo: true },
    { id: 2, nombre: 'Hamburguesa con Queso Doble', precio: new Decimal('160.00'), activo: true }
  );

  almacenMemoria.recetas.length = 0;
  almacenMemoria.recetas.push(
    { platilloId: 1, ingredienteId: 1, cantidad: new Decimal(1) },
    { platilloId: 1, ingredienteId: 2, cantidad: new Decimal(150) },
    { platilloId: 1, ingredienteId: 3, cantidad: new Decimal(1) },
    { platilloId: 2, ingredienteId: 1, cantidad: new Decimal(1) },
    { platilloId: 2, ingredienteId: 2, cantidad: new Decimal(300) },
    { platilloId: 2, ingredienteId: 3, cantidad: new Decimal(2) }
  );

  // Existencia inicial: 10 panes, 2000g carne, 15 quesos
  almacenMemoria.movimientos.length = 0;
  almacenMemoria.movimientos.push(
    { id: 1, ingredienteId: 1, tipo: 'ENTRADA', cantidad: new Decimal(10), motivo: 'Stock inicial', usuarioId: 1, creadoEn: new Date() },
    { id: 2, ingredienteId: 2, tipo: 'ENTRADA', cantidad: new Decimal(2000), motivo: 'Stock inicial', usuarioId: 1, creadoEn: new Date() },
    { id: 3, ingredienteId: 3, tipo: 'ENTRADA', cantidad: new Decimal(15), motivo: 'Stock inicial', usuarioId: 1, creadoEn: new Date() }
  );

  almacenMemoria.promociones.length = 0;
  almacenMemoria.ordenes.length = 0;
  almacenMemoria.ordenDetalles.length = 0;
  almacenMemoria.proxMovimientoId = 4;
  almacenMemoria.proxOrdenId = 1;
  almacenMemoria.proxOrdenDetalleId = 1;

  // 1. RECORRIDO DE PUNTA A PUNTA: CATÁLOGO -> COTIZACIÓN -> COBRO -> COMPROBANTE
  console.log('🏁 1. Recorrido Completo de Venta con Promoción y Comprobante:');

  // Crear promoción 2x1 en Hamburguesa Clásica
  const promo2x1 = await PromocionesService.crearPromocion(
    {
      nombre: 'Martes 2x1 Clásica',
      platilloId: 1,
      tipo: 'NXM',
      n: 2,
      m: 1,
      duracion: 'PERMANENTE'
    },
    1
  );

  // Trabajador (Usuario 2) consulta catálogo
  const catalogo = await CatalogoService.listarPlatillosPublicos();
  assert(catalogo.length === 2, 'Catálogo público devuelve 2 platillos activos con receta válida');

  // Cotizar orden: 2 Clásicas ($240 bruto) + 1 Doble ($160 bruto) = $400 bruto
  // Aplica promo 2x1 en Clásica (Ahorro $120.00). Total neto a pagar: $280.00
  const cotizacion = await PromocionesService.cotizarOrden([
    { platilloId: 1, cantidad: 2 },
    { platilloId: 2, cantidad: 1 }
  ]);

  assert(cotizacion.subtotalBruto === '400.00', 'Subtotal bruto calculado: $400.00');
  assert(cotizacion.descuentoTotal === '120.00', 'Descuento total calculado: $120.00');
  assert(cotizacion.total === '280.00', 'Total neto a cobrar: $280.00');
  assert(cotizacion.promocionAplicada?.id === promo2x1.id, 'Promoción aplicada identificada correctamente');

  // Confirmar venta por Usuario 2 (Cajero)
  const claveVenta1 = 'uuid-e2e-001';
  const venta1 = await VentasService.confirmarVenta(
    {
      claveIdempotencia: claveVenta1,
      metodoPago: 'EFECTIVO',
      items: [
        { platilloId: 1, cantidad: 2 },
        { platilloId: 2, cantidad: 1 }
      ],
      cotizacionAceptada: cotizacion
    },
    2
  );

  assert(venta1.folio === 'ORD-00001', 'Folio asignado: ORD-00001');
  assert(venta1.total === '280.00', 'Total registrado: $280.00');
  assert(venta1.partidas.length === 2, 'Contiene 2 partidas registradas');

  // Verificar consumo de stock:
  // 2 clásicas (2 panes, 300g carne, 2 quesos) + 1 doble (1 pan, 300g carne, 2 quesos) = 3 panes, 600g carne, 4 quesos
  const saldoPan1 = almacenMemoria.movimientos.filter((m) => m.ingredienteId === 1).reduce((acc, m) => acc.plus(m.cantidad), new Decimal(0));
  const saldoCarne1 = almacenMemoria.movimientos.filter((m) => m.ingredienteId === 2).reduce((acc, m) => acc.plus(m.cantidad), new Decimal(0));
  const saldoQueso1 = almacenMemoria.movimientos.filter((m) => m.ingredienteId === 3).reduce((acc, m) => acc.plus(m.cantidad), new Decimal(0));

  assert(saldoPan1.equals(7), 'Pan restante: 7 piezas (10 - 3)');
  assert(saldoCarne1.equals(1400), 'Carne restante: 1400 g (2000 - 600)');
  assert(saldoQueso1.equals(11), 'Queso restante: 11 piezas (15 - 4)');

  // 2. PRUEBA DE DOBLE CLIC / REINTENTO (CW-07)
  console.log('\n🖱️ 2. Prueba de Doble Clic y Reintento Simultáneo (CW-07):');
  const ventaDobleClic = await VentasService.confirmarVenta(
    {
      claveIdempotencia: claveVenta1,
      metodoPago: 'EFECTIVO',
      items: [
        { platilloId: 1, cantidad: 2 },
        { platilloId: 2, cantidad: 1 }
      ],
      cotizacionAceptada: cotizacion
    },
    2
  );

  assert(ventaDobleClic.id === venta1.id, 'Doble clic: Devuelve la misma orden original');
  assert(almacenMemoria.ordenes.length === 1, 'No se generaron órdenes duplicadas');
  const saldoPanPostDoble = almacenMemoria.movimientos.filter((m) => m.ingredienteId === 1).reduce((acc, m) => acc.plus(m.cantidad), new Decimal(0));
  assert(saldoPanPostDoble.equals(7), 'No hubo doble descuento en almacén');

  // 3. RECUPERACIÓN DE TRANSACCIÓN EN VUELO TRAS CAÍDA O RECARGA (CW-19)
  console.log('\n🔄 3. Recuperación de Transacción en Vuelo (CW-19):');
  const recuperada = await VentasService.buscarPorClaveIdempotencia(claveVenta1);
  assert(recuperada !== null, 'Venta pendiente recuperada con éxito por clave idempotencia');
  assert(recuperada?.folio === 'ORD-00001', 'Folio de la venta recuperada coincide');

  // 4. COMPETENCIA POR EL ÚLTIMO STOCK ENTRE DOS CAJAS (CW-06)
  console.log('\n🥊 4. Competencia de Dos Cajas por el Último Stock Disponible (CW-06):');
  // Ajustamos stock de pan a exactamente 2 piezas (sólo alcanza para 2 hamburguesas más)
  const ajustePan = await InventarioService.registrarAjuste({
    ingredienteId: 1,
    cantidad: -5,
    motivo: 'Ajuste para prueba de competencia de último stock',
    usuarioId: 1
  });
  const saldoPanComp = almacenMemoria.movimientos.filter((m) => m.ingredienteId === 1).reduce((acc, m) => acc.plus(m.cantidad), new Decimal(0));
  assert(saldoPanComp.equals(2), 'Saldo de pan ajustado a exactamente 2 piezas');

  // Caja 1 (Usuario 2) intenta vender 2 hamburguesas clásicas (demanda 2 panes)
  const cotCaja1 = await PromocionesService.cotizarOrden([{ platilloId: 1, cantidad: 2 }]);
  // Caja 2 (Usuario 3) intenta vender simultáneamente 1 hamburguesa clásica (demanda 1 pan)
  const cotCaja2 = await PromocionesService.cotizarOrden([{ platilloId: 1, cantidad: 1 }]);

  // Caja 1 gana la confirmación primero:
  const ventaCaja1 = await VentasService.confirmarVenta(
    {
      claveIdempotencia: 'uuid-caja-1',
      metodoPago: 'EFECTIVO',
      items: [{ platilloId: 1, cantidad: 2 }],
      cotizacionAceptada: cotCaja1
    },
    2
  );
  assert(ventaCaja1.estado === 'CONFIRMADA', 'Caja 1 confirma exitosamente consumiendo los últimos 2 panes');

  const saldoPanAgotado = almacenMemoria.movimientos.filter((m) => m.ingredienteId === 1).reduce((acc, m) => acc.plus(m.cantidad), new Decimal(0));
  assert(saldoPanAgotado.equals(0), 'Pan agotado (existencia = 0)');

  // Caja 2 intenta confirmar inmediatamente después: debe ser rechazada por stock insuficiente
  try {
    await VentasService.confirmarVenta(
      {
        claveIdempotencia: 'uuid-caja-2',
        metodoPago: 'EFECTIVO',
        items: [{ platilloId: 1, cantidad: 1 }],
        cotizacionAceptada: cotCaja2
      },
      3
    );
    assert(false, 'Caja 2 debe ser rechazada por falta de stock');
  } catch (err: any) {
    assert(err.codigo === 'STOCK_INSUFICIENTE', 'Caja 2 rechazada con STOCK_INSUFICIENTE (409)');
  }

  // Comprobar que el saldo nunca es negativo (Criterio CW-04 / CW-06):
  const saldoFinalPan = almacenMemoria.movimientos.filter((m) => m.ingredienteId === 1).reduce((acc, m) => acc.plus(m.cantidad), new Decimal(0));
  assert(saldoFinalPan.equals(0), 'El stock nunca es negativo (permanece en 0)');

  // 5. HISTORIAL, TOTAL DEL PERIODO Y ANULACIÓN CON MOTIVO (CW-02, CW-16)
  console.log('\n📜 5. Historial, Total del Periodo y Anulación con Motivo (CW-02 / CW-16):');

  // Administrador consulta historial global
  const historialGlobal = await VentasService.listarHistorial({}, 1, 'ADMINISTRADOR');
  assert(historialGlobal.cantidadConfirmadas === 2, 'Historial registra 2 ventas confirmadas');
  // Venta 1: $280.00, Venta Caja 1: $120.00 (2x1 de clásicas a 120 c/u con 2x1 = $120.00). Total: $400.00
  assert(historialGlobal.totalVentasConfirmadas === '400.00', 'Total acumulado confirmado: $400.00');

  // Administrador anula la venta 1 con motivo
  const anulacionVenta1 = await VentasService.anularVenta(
    venta1.id,
    'Cliente canceló por error en el pedido',
    1,
    'ADMINISTRADOR'
  );
  assert(anulacionVenta1.estado === 'ANULADA', 'Venta 1 pasa a estado ANULADA');
  assert(anulacionVenta1.motivoAnulacion === 'Cliente canceló por error en el pedido', 'Motivo registrado');

  // El total del periodo descuenta la venta 1 ($280.00) quedando únicamente $120.00
  const historialPostAnulacion = await VentasService.listarHistorial({}, 1, 'ADMINISTRADOR');
  assert(historialPostAnulacion.cantidadConfirmadas === 1, '1 venta confirmada vigente');
  assert(historialPostAnulacion.cantidadAnuladas === 1, '1 venta anulada registrada');
  assert(historialPostAnulacion.totalVentasConfirmadas === '120.00', 'Total confirmado vigente descuenta la orden anulada ($120.00)');

  console.log('\n================================================================================');
  console.log(`🏁 RESULTADO VERIFICACIÓN W4-06: ${testsPassed}/${testsPassed + testsFailed} EXITOSAS`);
  console.log('================================================================================');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Error no controlado en pruebas W4-06:', err);
  process.exit(1);
});
