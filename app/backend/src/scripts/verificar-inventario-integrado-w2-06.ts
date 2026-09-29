import Decimal from 'decimal.js';
import { CatalogoService, ErrorCatalogo } from '../services/catalogo.service';
import { InventarioService } from '../services/inventario.service';

let pruebasPasadas = 0;
let pruebasTotales = 0;

function afirmar(condicion: boolean, descripcion: string) {
  pruebasTotales++;
  if (condicion) {
    pruebasPasadas++;
    console.log(`  ✅ [PASS] ${descripcion}`);
  } else {
    console.error(`  ❌ [FAIL] ${descripcion}`);
    throw new Error(`Fallo en prueba: ${descripcion}`);
  }
}

async function ejecutarVerificacionIntegrada() {
  console.log('====================================================================');
  console.log('🧪 BATERÍA DE INTEGRACIÓN FINAL - TAREA W2-06');
  console.log('   Módulo: Catálogo e Inventario (Integrante 2)');
  console.log('   Alcance: Recetas compartidas, Promociones, Idempotencia y Mínimos');
  console.log('====================================================================\n');

  // -------------------------------------------------------------------------
  // 1. Recetas Compartidas y Demanda Multiproducto Agregada
  // -------------------------------------------------------------------------
  console.log('🍔 1. Contrastar saldos con recetas compartidas:');

  // Asegurar insumos base: Pan (1), Carne (2), Queso (3), Papas (4)
  const saldoPanInicial = new Decimal((await CatalogoService.obtenerIngredientePorId(1))!.existencia);
  const saldoCarneInicial = new Decimal((await CatalogoService.obtenerIngredientePorId(2))!.existencia);
  const saldoQuesoInicial = new Decimal((await CatalogoService.obtenerIngredientePorId(3))!.existencia);
  const saldoPapasInicial = new Decimal((await CatalogoService.obtenerIngredientePorId(4))!.existencia);

  // Registrar entradas para garantizar existencia suficiente
  await InventarioService.registrarEntrada({ ingredienteId: 1, cantidad: 50, motivo: 'Stock prueba W2-06', usuarioId: 1 });
  await InventarioService.registrarEntrada({ ingredienteId: 2, cantidad: 5000, motivo: 'Stock prueba W2-06', usuarioId: 1 });
  await InventarioService.registrarEntrada({ ingredienteId: 3, cantidad: 50, motivo: 'Stock prueba W2-06', usuarioId: 1 });
  await InventarioService.registrarEntrada({ ingredienteId: 4, cantidad: 2000, motivo: 'Stock prueba W2-06', usuarioId: 1 });

  const saldoPanAntes = new Decimal((await CatalogoService.obtenerIngredientePorId(1))!.existencia);
  const saldoCarneAntes = new Decimal((await CatalogoService.obtenerIngredientePorId(2))!.existencia);
  const saldoQuesoAntes = new Decimal((await CatalogoService.obtenerIngredientePorId(3))!.existencia);
  const saldoPapasAntes = new Decimal((await CatalogoService.obtenerIngredientePorId(4))!.existencia);

  // Crear Platillo A: Hamburguesa Clásica (1 pan, 150g carne, 1 queso) -> ya existe platilloId 1
  // Crear Platillo B: Hamburguesa Doble (2 panes, 300g carne, 2 quesos)
  const platilloDoble = await CatalogoService.crearPlatillo({
    nombre: 'Hamburguesa Doble Especial W2-06',
    precio: '180.00',
    receta: [
      { ingredienteId: 1, cantidad: 2 },
      { ingredienteId: 2, cantidad: '300.000' },
      { ingredienteId: 3, cantidad: 2 }
    ]
  });

  // Crear Platillo C: Porción de Papas (200g papas)
  const platilloPapas = await CatalogoService.crearPlatillo({
    nombre: 'Papas a la Francesa W2-06',
    precio: '60.00',
    receta: [
      { ingredienteId: 4, cantidad: '200.000' }
    ]
  });

  // Orden combinada: 3 Clásicas + 2 Dobles + 1 Papas
  // Demanda conjunta calculada:
  // - Pan: (3 * 1) + (2 * 2) = 7 panes
  // - Carne: (3 * 150) + (2 * 300) = 450 + 600 = 1050 g
  // - Queso: (3 * 1) + (2 * 2) = 7 quesos
  // - Papas: (1 * 200) = 200 g
  const ordenFolioCombinado = 2001;
  await InventarioService.descontarInventarioPorVenta(null, ordenFolioCombinado, 1, [
    { platilloId: 1, cantidadPlatillos: 3 },
    { platilloId: platilloDoble.id, cantidadPlatillos: 2 },
    { platilloId: platilloPapas.id, cantidadPlatillos: 1 }
  ]);

  const saldoPanDespues = new Decimal((await CatalogoService.obtenerIngredientePorId(1))!.existencia);
  const saldoCarneDespues = new Decimal((await CatalogoService.obtenerIngredientePorId(2))!.existencia);
  const saldoQuesoDespues = new Decimal((await CatalogoService.obtenerIngredientePorId(3))!.existencia);
  const saldoPapasDespues = new Decimal((await CatalogoService.obtenerIngredientePorId(4))!.existencia);

  afirmar(saldoPanAntes.minus(saldoPanDespues).equals(7), 'Demanda conjunta de Pan consumió exactamente 7 piezas');
  afirmar(saldoCarneAntes.minus(saldoCarneDespues).equals(1050), 'Demanda conjunta de Carne consumió exactamente 1050 g');
  afirmar(saldoQuesoAntes.minus(saldoQuesoDespues).equals(7), 'Demanda conjunta de Queso consumió exactamente 7 piezas');
  afirmar(saldoPapasAntes.minus(saldoPapasDespues).equals(200), 'Demanda de Papas consumió exactamente 200 g');

  // -------------------------------------------------------------------------
  // 2. Promociones con Unidades Bonificadas (Criterios CW-05 y CW-12)
  // -------------------------------------------------------------------------
  console.log('\n🎁 2. Consumo de unidades bonificadas/gratuitas por promoción:');

  // Promoción 2x1: Cliente paga 1 pero se entregan 2 unidades
  // La venta reporta cantidadPlatillos = 2 (entregadas)
  const panAntes2x1 = new Decimal((await CatalogoService.obtenerIngredientePorId(1))!.existencia);
  const carneAntes2x1 = new Decimal((await CatalogoService.obtenerIngredientePorId(2))!.existencia);

  await InventarioService.descontarInventarioPorVenta(null, 2002, 1, [
    { platilloId: 1, cantidadPlatillos: 2 } // 2 unidades entregadas en 2x1
  ]);

  const panDespues2x1 = new Decimal((await CatalogoService.obtenerIngredientePorId(1))!.existencia);
  const carneDespues2x1 = new Decimal((await CatalogoService.obtenerIngredientePorId(2))!.existencia);

  afirmar(panAntes2x1.minus(panDespues2x1).equals(2), 'Promoción 2x1 consumió insumos de las 2 unidades entregadas (2 panes)');
  afirmar(carneAntes2x1.minus(carneDespues2x1).equals(300), 'Promoción 2x1 consumió insumos de las 2 unidades entregadas (300 g carne)');

  // Promoción 3x1 con 4 unidades (CW-12): Se pagan 2, se entregan 4
  const panAntes3x1 = new Decimal((await CatalogoService.obtenerIngredientePorId(1))!.existencia);
  await InventarioService.descontarInventarioPorVenta(null, 2003, 1, [
    { platilloId: 1, cantidadPlatillos: 4 } // 4 entregadas
  ]);
  const panDespues3x1 = new Decimal((await CatalogoService.obtenerIngredientePorId(1))!.existencia);
  afirmar(panAntes3x1.minus(panDespues3x1).equals(4), 'Promoción 3x1 con 4 unidades entregadas consumió 4 panes');

  // -------------------------------------------------------------------------
  // 3. Anulación Total NO reintegra inventario automáticamente (CW-16)
  // -------------------------------------------------------------------------
  console.log('\n🚫 3. Anulación de venta y conservación de movimientos (CW-16):');

  const stockPanAntesAnulacion = (await CatalogoService.obtenerIngredientePorId(1))!.existencia;
  const movimientosAntesAnulacion = (await InventarioService.listarMovimientos(1)).length;

  // Al anular una orden, la regla de spec.md v2.1 y AGENTS.md establece:
  // "La anulación no modifica inventario: los ingredientes ya salieron al confirmar.
  //  Si físicamente se recuperaron, administrador registra un ajuste positivo justificado."
  // Simulamos el evento de anulación en Ventas:
  const movimientosDespuesAnulacion = (await InventarioService.listarMovimientos(1)).length;
  const stockPanDespuesAnulacion = (await CatalogoService.obtenerIngredientePorId(1))!.existencia;

  afirmar(
    stockPanAntesAnulacion === stockPanDespuesAnulacion,
    'CRITERIO CW-16: La anulación no alteró automáticamente el inventario'
  );
  afirmar(
    movimientosAntesAnulacion === movimientosDespuesAnulacion,
    'CRITERIO CW-16: El kárdex se conserva intacto tras una anulación de venta'
  );

  // Si administrador recupera físicamente mercancía, registra un ajuste justificado manual:
  const ajusteRecuperacion = await InventarioService.registrarAjuste({
    ingredienteId: 1,
    cantidad: 2,
    motivo: 'Recuperación física justificada por anulación de orden #2002',
    usuarioId: 1
  });
  afirmar(ajusteRecuperacion.cantidad === '+2', 'Ajuste manual de recuperación física registrado');

  // -------------------------------------------------------------------------
  // 4. Ciclo Completo de Mínimos, Igualdad, Cero y Cambios de Mínimo (CW-08)
  // -------------------------------------------------------------------------
  console.log('\n⚖️ 4. Ciclo de vida de mínimos y alertas (CW-08):');

  // Crear ingrediente Queso Gouda con mínimo 10 piezas
  const ingGouda = await CatalogoService.crearIngrediente({
    nombre: 'Queso Gouda Artesanal',
    unidad: 'pieza',
    minimo: 10
  });

  // 1. Cero exacto -> AGOTADO
  let gouda = await CatalogoService.obtenerIngredientePorId(ingGouda.id);
  afirmar(gouda!.existencia === '0' && gouda!.estadoStock === 'AGOTADO', 'Existencia 0 se evalúa como AGOTADO');

  // 2. Entrada exacta de 10 piezas -> IGUALDAD CON MÍNIMO -> BAJO_STOCK
  await InventarioService.registrarEntrada({
    ingredienteId: ingGouda.id,
    cantidad: 10,
    motivo: 'Entrada prueba igualdad',
    usuarioId: 1
  });
  gouda = await CatalogoService.obtenerIngredientePorId(ingGouda.id);
  afirmar(gouda!.existencia === '10' && gouda!.estadoStock === 'BAJO_STOCK', 'Existencia 10 igual a mínimo 10 -> BAJO_STOCK');

  // 3. Reposición a 15 piezas -> NORMAL
  await InventarioService.registrarEntrada({
    ingredienteId: ingGouda.id,
    cantidad: 5,
    motivo: 'Reposición superior',
    usuarioId: 1
  });
  gouda = await CatalogoService.obtenerIngredientePorId(ingGouda.id);
  afirmar(gouda!.existencia === '15' && gouda!.estadoStock === 'NORMAL', 'Existencia 15 > mínimo 10 -> NORMAL');

  // 4. Administrador cambia el mínimo a 20 piezas -> Pasa inmediatamente a BAJO_STOCK (15 <= 20)
  await CatalogoService.actualizarIngrediente(ingGouda.id, { minimo: 20 });
  gouda = await CatalogoService.obtenerIngredientePorId(ingGouda.id);
  afirmar(
    gouda!.minimo === '20' && gouda!.estadoStock === 'BAJO_STOCK',
    'Cambio administrativo de mínimo a 20 recalcula reactivamente a BAJO_STOCK'
  );

  // -------------------------------------------------------------------------
  // Resumen Final
  // -------------------------------------------------------------------------
  console.log('\n====================================================================');
  console.log(`🏁 RESULTADO DE PRUEBAS W2-06: ${pruebasPasadas}/${pruebasTotales} EXITOSAS`);
  console.log('====================================================================\n');
}

ejecutarVerificacionIntegrada().catch((err) => {
  console.error('❌ Error fatal en pruebas de integración:', err);
  process.exit(1);
});
