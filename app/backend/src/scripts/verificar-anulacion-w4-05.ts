import Decimal from 'decimal.js';
import { VentasService } from '../services/ventas.service';
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
  console.log('🧪 BATERÍA DE PRUEBAS DE ANULACIÓN SENCILLA - TAREA W4-05');
  console.log('   Módulo: Punto de Venta e Historial (Integrante 4)');
  console.log('   Alcance: Rol Admin CW-02, Idempotencia CW-16, No Reintegro CW-16');
  console.log('====================================================================\n');

  // Inicializar estado en memoria
  almacenMemoria.ingredientes = [
    { id: 1, nombre: 'Pan de Hamburguesa', unidad: 'pieza', minimo: new Decimal(10), activo: true },
    { id: 2, nombre: 'Carne de Res', unidad: 'g', minimo: new Decimal(1000), activo: true },
    { id: 3, nombre: 'Queso Amarillo', unidad: 'pieza', minimo: new Decimal(5), activo: true }
  ];
  almacenMemoria.platillos = [
    { id: 1, nombre: 'Hamburguesa Clásica', precio: new Decimal('100.00'), activo: true }
  ];
  almacenMemoria.recetas = [
    { platilloId: 1, ingredienteId: 1, cantidad: new Decimal(1) },
    { platilloId: 1, ingredienteId: 2, cantidad: new Decimal(150) },
    { platilloId: 1, ingredienteId: 3, cantidad: new Decimal(1) }
  ];
  almacenMemoria.movimientos = [
    { id: 1, ingredienteId: 1, tipo: 'ENTRADA', cantidad: new Decimal(50), motivo: 'Stock inicial', usuarioId: 1, creadoEn: new Date() },
    { id: 2, ingredienteId: 2, tipo: 'ENTRADA', cantidad: new Decimal(5000), motivo: 'Stock inicial', usuarioId: 1, creadoEn: new Date() },
    { id: 3, ingredienteId: 3, tipo: 'ENTRADA', cantidad: new Decimal(50), motivo: 'Stock inicial', usuarioId: 1, creadoEn: new Date() }
  ];
  almacenMemoria.promociones = [];
  almacenMemoria.ordenes = [];
  almacenMemoria.ordenDetalles = [];
  almacenMemoria.proxMovimientoId = 4;
  almacenMemoria.proxOrdenId = 1;
  almacenMemoria.proxOrdenDetalleId = 1;

  // Registrar dos ventas:
  // Venta 1: 1 Hamburguesa ($100.00)
  const cot1 = await PromocionesService.cotizarOrden([{ platilloId: 1, cantidad: 1 }]);
  const orden1 = await VentasService.confirmarVenta(
    {
      claveIdempotencia: 'idemp-anul-001',
      metodoPago: 'EFECTIVO',
      items: [{ platilloId: 1, cantidad: 1 }],
      cotizacionAceptada: cot1
    },
    2
  );

  // Venta 2: 2 Hamburguesas ($200.00)
  const cot2 = await PromocionesService.cotizarOrden([{ platilloId: 1, cantidad: 2 }]);
  const orden2 = await VentasService.confirmarVenta(
    {
      claveIdempotencia: 'idemp-anul-002',
      metodoPago: 'EXTERNO',
      items: [{ platilloId: 1, cantidad: 2 }],
      cotizacionAceptada: cot2
    },
    2
  );

  // Estado inicial del historial: 2 confirmadas, total $300.00
  const resumenInicial = await VentasService.listarHistorial({}, 1, 'ADMINISTRADOR');
  assert(resumenInicial.cantidadConfirmadas === 2, '2 ventas confirmadas inicialmente');
  assert(resumenInicial.cantidadAnuladas === 0, '0 ventas anuladas inicialmente');
  assert(resumenInicial.totalVentasConfirmadas === '300.00', 'Total vigente inicial: $300.00');

  // Registrar saldos de inventario tras ambas ventas (pan consumido: 1 + 2 = 3 piezas)
  const saldoPanPrevio = almacenMemoria.movimientos.filter((m) => m.ingredienteId === 1).reduce((acc, m) => acc.plus(m.cantidad), new Decimal(0));
  assert(saldoPanPrevio.equals(47), 'Saldo previo de pan: 47 piezas (50 - 3)');
  const cantMovimientosPrevios = almacenMemoria.movimientos.length;

  // 1. Control de Perfil en Anulación (Criterio CW-02)
  console.log('🚫 1. Rechazo de Anulación para Perfil TRABAJADOR (CW-02):');
  try {
    await VentasService.anularVenta(orden1.id, 'Error de cobro', 2, 'TRABAJADOR');
    assert(false, 'Un trabajador jamás debe poder anular una venta');
  } catch (err: any) {
    assert(err.codigo === 'ACCESO_DENEGADO', 'CW-02: Rechaza con ACCESO_DENEGADO (403)');
    assert(err.statusCode === 403, 'Código HTTP es 403 Prohibido');
  }

  // 2. Validación de Motivo Obligatorio (Criterio CW-16)
  console.log('\n📝 2. Requerimiento de Motivo Obligatorio (CW-16):');
  try {
    await VentasService.anularVenta(orden1.id, '   ', 1, 'ADMINISTRADOR');
    assert(false, 'Debe rechazar anulación sin motivo justificado');
  } catch (err: any) {
    assert(err.codigo === 'MOTIVO_REQUERIDO', 'Rechaza con MOTIVO_REQUERIDO ante motivo vacío');
    assert(err.statusCode === 400, 'Código HTTP es 400');
  }

  // 3. Anulación Exitosa por Administrador (Criterio CW-16)
  console.log('\n✅ 3. Anulación Exitosa por Administrador (CW-16):');
  const motivoAnulacion = 'Cliente canceló el pedido por demora en mesa';
  const ordenAnulada = await VentasService.anularVenta(orden1.id, motivoAnulacion, 1, 'ADMINISTRADOR');

  assert(ordenAnulada.estado === 'ANULADA', 'La orden cambió de estado a ANULADA');
  assert(ordenAnulada.motivoAnulacion === motivoAnulacion, 'Registró el motivo exacto de la anulación');
  assert(ordenAnulada.usuarioAnulacionId === 1, 'Registró el ID del administrador autor');
  assert(ordenAnulada.anuladoEn !== null, 'Registró la fecha y hora UTC de anulación');
  assert(ordenAnulada.partidas.length === 1, 'Conserva intactas las partidas de detalle originales');

  // 4. Garantía de No Reintegro Automático de Inventario (Criterio CW-16)
  console.log('\n📦 4. Garantía de No Reintegro Automático de Inventario (CW-16):');
  // Se comprueba que NO se hayan insertado movimientos de entrada o ajuste automáticos
  const cantMovimientosPost = almacenMemoria.movimientos.length;
  assert(cantMovimientosPost === cantMovimientosPrevios, 'CW-16: No se generaron movimientos automáticos en el kárdex');

  const saldoPanPost = almacenMemoria.movimientos.filter((m) => m.ingredienteId === 1).reduce((acc, m) => acc.plus(m.cantidad), new Decimal(0));
  assert(saldoPanPost.equals(47), 'CW-16: El saldo de inventario se conserva en 47 (los insumos ya salieron)');

  // 5. Idempotencia en Anulación Repetida (Criterio CW-16)
  console.log('\n🔁 5. Idempotencia ante Anulación Repetida (CW-16):');
  const ordenAnuladaDoble = await VentasService.anularVenta(orden1.id, 'Otro motivo posterior', 1, 'ADMINISTRADOR');
  assert(ordenAnuladaDoble.estado === 'ANULADA', 'Permanece en estado ANULADA');
  assert(ordenAnuladaDoble.motivoAnulacion === motivoAnulacion, 'Idempotencia: Conserva el motivo original de la primera anulación');

  // 6. Exclusión de la Venta Anulada en el Total del Periodo (Criterio CW-16)
  console.log('\n📊 6. Exclusión de la Orden Anulada en Total del Periodo (CW-16):');
  const resumenPost = await VentasService.listarHistorial({}, 1, 'ADMINISTRADOR');
  assert(resumenPost.cantidadConfirmadas === 1, 'CW-16: Ventas confirmadas se reducen a 1 (orden 2)');
  assert(resumenPost.cantidadAnuladas === 1, 'CW-16: Ventas anuladas se computan en 1 (orden 1)');
  assert(resumenPost.totalVentasConfirmadas === '200.00', 'CW-16: Total confirmado descuenta los $100.00 de la venta anulada ($200.00)');
  assert(resumenPost.ordenes.length === 2, 'El historial sigue listando las 2 órdenes para auditoría');

  console.log('\n====================================================================');
  console.log(`🏁 RESULTADO DE PRUEBAS W4-05: ${testsPassed}/${testsPassed + testsFailed} EXITOSAS`);
  console.log('====================================================================');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Error no controlado en pruebas W4-05:', err);
  process.exit(1);
});
