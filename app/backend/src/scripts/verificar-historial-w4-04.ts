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
  console.log('🧪 BATERÍA DE PRUEBAS DE HISTORIAL Y COMPROBANTE - TAREA W4-04');
  console.log('   Módulo: Punto de Venta e Historial (Integrante 4)');
  console.log('   Alcance: Filtro por Perfil CW-02, Inmutabilidad CW-15, Total por Periodo');
  console.log('====================================================================\n');

  // Inicializar estado en memoria in-place para mantener referencias
  almacenMemoria.ingredientes.length = 0;
  almacenMemoria.ingredientes.push(
    { id: 1, nombre: 'Pan de Hamburguesa', unidad: 'pieza', minimo: new Decimal(10), activo: true },
    { id: 2, nombre: 'Carne de Res', unidad: 'g', minimo: new Decimal(1000), activo: true },
    { id: 3, nombre: 'Queso Amarillo', unidad: 'pieza', minimo: new Decimal(5), activo: true }
  );

  almacenMemoria.platillos.length = 0;
  almacenMemoria.platillos.push(
    { id: 1, nombre: 'Hamburguesa Clásica', precio: new Decimal('100.00'), activo: true },
    { id: 2, nombre: 'Hamburguesa Doble', precio: new Decimal('150.00'), activo: true }
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

  almacenMemoria.movimientos.length = 0;
  almacenMemoria.movimientos.push(
    { id: 1, ingredienteId: 1, tipo: 'ENTRADA', cantidad: new Decimal(100), motivo: 'Stock inicial', usuarioId: 1, creadoEn: new Date() },
    { id: 2, ingredienteId: 2, tipo: 'ENTRADA', cantidad: new Decimal(10000), motivo: 'Stock inicial', usuarioId: 1, creadoEn: new Date() },
    { id: 3, ingredienteId: 3, tipo: 'ENTRADA', cantidad: new Decimal(100), motivo: 'Stock inicial', usuarioId: 1, creadoEn: new Date() }
  );

  almacenMemoria.promociones = [];
  almacenMemoria.ordenes = [];
  almacenMemoria.ordenDetalles = [];
  almacenMemoria.proxMovimientoId = 4;
  almacenMemoria.proxOrdenId = 1;
  almacenMemoria.proxOrdenDetalleId = 1;

  // Registrar venta 1 por Trabajador 1 (Usuario ID 2)
  const cot1 = await PromocionesService.cotizarOrden([{ platilloId: 1, cantidad: 1 }]);
  const orden1 = await VentasService.confirmarVenta(
    {
      claveIdempotencia: 'idemp-hist-001',
      metodoPago: 'EFECTIVO',
      items: [{ platilloId: 1, cantidad: 1 }],
      cotizacionAceptada: cot1
    },
    2 // Trabajador 1
  );

  // Registrar venta 2 por Trabajador 2 (Usuario ID 3)
  const cot2 = await PromocionesService.cotizarOrden([{ platilloId: 2, cantidad: 2 }]);
  const orden2 = await VentasService.confirmarVenta(
    {
      claveIdempotencia: 'idemp-hist-002',
      metodoPago: 'EXTERNO',
      items: [{ platilloId: 2, cantidad: 2 }],
      cotizacionAceptada: cot2
    },
    3 // Trabajador 2
  );

  // 1. Control de Acceso en Historial (Criterio CW-02)
  console.log('👤 1. Control de Acceso en Historial por Perfil (CW-02):');
  // Trabajador 1 consulta su historial: debe ver solo orden1
  const historialTrabajador1 = await VentasService.listarHistorial({}, 2, 'TRABAJADOR');
  assert(historialTrabajador1.ordenes.length === 1, 'Trabajador 1 solo ve 1 venta en su historial');
  assert(historialTrabajador1.ordenes[0].id === orden1.id, 'La venta visualizada es la propia (orden 1)');
  assert(historialTrabajador1.totalVentasConfirmadas === '100.00', 'Total del periodo para Trabajador 1 es $100.00');

  // Trabajador 1 intenta consultar directamente la orden de Trabajador 2 por ID
  try {
    await VentasService.obtenerPorId(orden2.id, 2, 'TRABAJADOR');
    assert(false, 'Trabajador 1 no debe poder consultar el comprobante de Trabajador 2');
  } catch (err: any) {
    assert(err.codigo === 'ACCESO_DENEGADO', 'CW-02: Rechaza consulta de venta ajena con ACCESO_DENEGADO (403)');
    assert(err.statusCode === 403, 'Código HTTP es 403 Prohibido');
  }

  // Administrador consulta historial: debe ver ambas órdenes
  const historialAdmin = await VentasService.listarHistorial({}, 1, 'ADMINISTRADOR');
  assert(historialAdmin.ordenes.length === 2, 'Administrador ve las ventas de toda la sucursal (2 ventas)');
  assert(historialAdmin.cantidadConfirmadas === 2, 'Registra 2 ventas confirmadas');
  assert(historialAdmin.totalVentasConfirmadas === '400.00', 'Total acumulado de la sucursal: $400.00 (100 + 300)');

  // Administrador puede consultar cualquier comprobante por ID
  const comprobante2 = await VentasService.obtenerPorId(orden2.id, 1, 'ADMINISTRADOR');
  assert(comprobante2.folio === 'ORD-00002', 'Administrador obtiene comprobante ORD-00002');
  assert(comprobante2.total === '300.00', 'Detalle de comprobante con total $300.00');
  assert(comprobante2.partidas[0].cantidad === 2, 'Partidas históricas coinciden');

  // 2. Inmutabilidad Histórica ante Cambios Administrativos (Criterio CW-15)
  console.log('\n📜 2. Inmutabilidad Histórica de Ventas Anteriores (CW-15):');
  // Modificamos el precio del platillo 1 de $100 a $180
  almacenMemoria.platillos[0].precio = new Decimal('180.00');
  almacenMemoria.platillos[0].nombre = 'Hamburguesa Clásica Gourmet';

  // Desactivamos el platillo 2
  almacenMemoria.platillos[1].activo = false;

  // Consultamos nuevamente la orden 1 histórica:
  const orden1Recuperada = await VentasService.obtenerPorId(orden1.id, 2, 'TRABAJADOR');
  assert(orden1Recuperada.total === '100.00', 'CW-15: Total de la orden permanece en $100.00 a pesar de cambio a $180');
  assert(orden1Recuperada.partidas[0].nombrePlatillo === 'Hamburguesa Clásica', 'CW-15: Nombre histórico de partida permanece intacto');
  assert(orden1Recuperada.partidas[0].precioUnitario === '100.00', 'CW-15: Precio unitario histórico permanece en $100.00');

  // Consultamos nuevamente la orden 2 histórica:
  const orden2Recuperada = await VentasService.obtenerPorId(orden2.id, 1, 'ADMINISTRADOR');
  assert(orden2Recuperada.total === '300.00', 'CW-15: Venta 2 permanece inalterada a pesar de que el platillo fue desactivado');

  console.log('\n====================================================================');
  console.log(`🏁 RESULTADO DE PRUEBAS W4-04: ${testsPassed}/${testsPassed + testsFailed} EXITOSAS`);
  console.log('====================================================================');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Error no controlado en pruebas W4-04:', err);
  process.exit(1);
});
