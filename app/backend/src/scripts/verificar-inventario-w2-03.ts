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

async function ejecutarPruebasInventario() {
  console.log('===============================================================');
  console.log('🧪 BATERÍA DE PRUEBAS DE VERIFICACIÓN - TAREA W2-03');
  console.log('   Módulo: Catálogo e Inventario (Integrante 2)');
  console.log('   Alcance: Movimientos, Kárdex, Saldo No Negativo y Consumo CW');
  console.log('===============================================================\n');

  // -------------------------------------------------------------------------
  // 1. Registro y Validación de Entradas de Inventario
  // -------------------------------------------------------------------------
  console.log('📥 1. Verificación de Entradas de Inventario:');

  const ingPan = await CatalogoService.obtenerIngredientePorId(1); // Pan de Hamburguesa (pieza)
  afirmar(ingPan !== null, 'Ingrediente Pan existe');
  const existenciaPanAntes = new Decimal(ingPan!.existencia);

  const entradaPan = await InventarioService.registrarEntrada({
    ingredienteId: 1,
    cantidad: 20,
    motivo: 'Compra a panadería local (Remisión #502)',
    usuarioId: 1
  });

  afirmar(entradaPan.tipo === 'ENTRADA', 'Tipo de movimiento es ENTRADA');
  afirmar(entradaPan.cantidad === '+20', 'Cantidad formateada con signo positivo (+20)');
  afirmar(entradaPan.motivo === 'Compra a panadería local (Remisión #502)', 'Conserva motivo');
  afirmar(entradaPan.usuarioId === 1, 'Conserva autor');

  const ingPanDespues = await CatalogoService.obtenerIngredientePorId(1);
  const existenciaPanDespues = new Decimal(ingPanDespues!.existencia);
  afirmar(
    existenciaPanDespues.minus(existenciaPanAntes).equals(20),
    'Existencia incrementó exactamente en la cantidad de entrada (+20)'
  );

  // Rechazo de entrada con cantidad no positiva
  try {
    await InventarioService.registrarEntrada({
      ingredienteId: 1,
      cantidad: 0,
      usuarioId: 1
    });
    afirmar(false, 'Debe rechazar entrada con cantidad 0');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo && e.codigo === 'DATOS_INVALIDOS', 'Rechaza entrada con cantidad <= 0');
  }

  // Rechazo de entrada con decimales en piezas
  try {
    await InventarioService.registrarEntrada({
      ingredienteId: 1,
      cantidad: '3.75',
      usuarioId: 1
    });
    afirmar(false, 'Debe rechazar decimales en pieza');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo && e.codigo === 'CANTIDAD_INVALIDA', 'Rechaza cantidad fraccionaria en pieza');
  }

  // -------------------------------------------------------------------------
  // 2. Registro de Ajustes y Prevención de Stock Negativo (CW-04)
  // -------------------------------------------------------------------------
  console.log('\n⚖️ 2. Verificación de Ajustes y Regla de Stock No Negativo (CW-04):');

  // Ajuste positivo con motivo
  const ajustePositivo = await InventarioService.registrarAjuste({
    ingredienteId: 1,
    cantidad: 5,
    motivo: 'Sobrante verificado en conteo físico de turno matutino',
    usuarioId: 1
  });
  afirmar(ajustePositivo.tipo === 'AJUSTE', 'Tipo de movimiento es AJUSTE');
  afirmar(ajustePositivo.cantidad === '+5', 'Cantidad con signo positivo (+5)');

  // Ajuste negativo (merma justificada)
  const ajusteNegativo = await InventarioService.registrarAjuste({
    ingredienteId: 1,
    cantidad: -3,
    motivo: 'Merma por empaque dañado',
    usuarioId: 1
  });
  afirmar(ajusteNegativo.tipo === 'AJUSTE', 'Tipo de merma registrada como AJUSTE');
  afirmar(ajusteNegativo.cantidad === '-3', 'Cantidad con signo negativo (-3)');

  // Rechazo de ajuste sin motivo obligatorio
  try {
    await InventarioService.registrarAjuste({
      ingredienteId: 1,
      cantidad: -2,
      motivo: '   ',
      usuarioId: 1
    });
    afirmar(false, 'Debe rechazar ajuste con motivo vacío');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo && e.codigo === 'DATOS_INVALIDOS', 'Rechaza ajuste con motivo en blanco');
  }

  // CW-04: Garantía de que el ajuste no puede producir saldo negativo
  const ingCarne = await CatalogoService.obtenerIngredientePorId(2); // Carne (g)
  const stockCarneActual = new Decimal(ingCarne!.existencia);

  try {
    // Intentar un ajuste negativo mayor al stock disponible
    const ajusteExcesivo = stockCarneActual.plus(100).neg();
    await InventarioService.registrarAjuste({
      ingredienteId: 2,
      cantidad: ajusteExcesivo.toString(),
      motivo: 'Ajuste excesivo erróneo',
      usuarioId: 1
    });
    afirmar(false, 'Debe rechazar ajuste que genera stock negativo');
  } catch (e: any) {
    afirmar(
      e instanceof ErrorCatalogo && e.codigo === 'STOCK_NEGATIVO_NO_PERMITIDO',
      'CRITERIO CW-04: Rechaza ajuste negativo que superaría las existencias (stock nunca negativo)'
    );
  }

  // -------------------------------------------------------------------------
  // 3. Consumo por Venta (CW-05: 2 hamburguesas consumen 2 panes, 300g, 2 quesos)
  // -------------------------------------------------------------------------
  console.log('\n🍔 3. Consumo Transaccional por Venta (CW-05):');

  // Registrar estado previo de ingredientes 1 (Pan), 2 (Carne), 3 (Queso)
  const saldoPanAntesVenta = new Decimal((await CatalogoService.obtenerIngredientePorId(1))!.existencia);
  const saldoCarneAntesVenta = new Decimal((await CatalogoService.obtenerIngredientePorId(2))!.existencia);
  const saldoQuesoAntesVenta = new Decimal((await CatalogoService.obtenerIngredientePorId(3))!.existencia);

  // Venta de 2 Hamburguesas Clásicas (platilloId: 1)
  const ordenFolio = 1001;
  await InventarioService.descontarInventarioPorVenta(null, ordenFolio, 2, [
    { platilloId: 1, cantidadPlatillos: 2 }
  ]);

  const saldoPanDespuesVenta = new Decimal((await CatalogoService.obtenerIngredientePorId(1))!.existencia);
  const saldoCarneDespuesVenta = new Decimal((await CatalogoService.obtenerIngredientePorId(2))!.existencia);
  const saldoQuesoDespuesVenta = new Decimal((await CatalogoService.obtenerIngredientePorId(3))!.existencia);

  afirmar(
    saldoPanAntesVenta.minus(saldoPanDespuesVenta).equals(2),
    'CRITERIO CW-05: Vender 2 hamburguesas consumió exactamente 2 panes'
  );
  afirmar(
    saldoCarneAntesVenta.minus(saldoCarneDespuesVenta).equals(300),
    'CRITERIO CW-05: Vender 2 hamburguesas consumió exactamente 300 g de carne'
  );
  afirmar(
    saldoQuesoAntesVenta.minus(saldoQuesoDespuesVenta).equals(2),
    'CRITERIO CW-05: Vender 2 hamburguesas consumió exactamente 2 piezas de queso'
  );

  // -------------------------------------------------------------------------
  // 4. Demanda Agregada Conjunta y Unidades Gratuitas
  // -------------------------------------------------------------------------
  console.log('\n👥 4. Demanda Conjunta Multiproducto y Promociones:');

  // Crear platillo Hamburguesa Doble: 2 panes, 300g carne, 2 quesos
  const platilloDoble = await CatalogoService.crearPlatillo({
    nombre: 'Hamburguesa Doble Gourmet',
    precio: '175.00',
    receta: [
      { ingredienteId: 1, cantidad: 2 },
      { ingredienteId: 2, cantidad: 300 },
      { ingredienteId: 3, cantidad: 2 }
    ]
  });

  const saldoPanBase = new Decimal((await CatalogoService.obtenerIngredientePorId(1))!.existencia);
  const saldoCarneBase = new Decimal((await CatalogoService.obtenerIngredientePorId(2))!.existencia);

  // Orden con: 1 Clásica + 1 Doble (Demanda conjunta: Pan = 1+2 = 3; Carne = 150+300 = 450)
  await InventarioService.descontarInventarioPorVenta(null, 1002, 2, [
    { platilloId: 1, cantidadPlatillos: 1 },
    { platilloId: platilloDoble.id, cantidadPlatillos: 1 }
  ]);

  const saldoPanFin = new Decimal((await CatalogoService.obtenerIngredientePorId(1))!.existencia);
  const saldoCarneFin = new Decimal((await CatalogoService.obtenerIngredientePorId(2))!.existencia);

  afirmar(saldoPanBase.minus(saldoPanFin).equals(3), 'Demanda agregada de pan consumió 3 piezas (1+2)');
  afirmar(saldoCarneBase.minus(saldoCarneFin).equals(450), 'Demanda agregada de carne consumió 450 g (150+300)');

  // -------------------------------------------------------------------------
  // 5. Rechazo Atómico por Stock Insuficiente (CW-06)
  // -------------------------------------------------------------------------
  console.log('\n🚫 5. Rechazo Atómico por Insuficiencia y Prevención de Negativos (CW-06):');

  const stockPanAntesRechazo = (await CatalogoService.obtenerIngredientePorId(1))!.existencia;

  try {
    // Intentar vender 500 hamburguesas dobles (requiere 1000 panes, inexistentes)
    await InventarioService.descontarInventarioPorVenta(null, 1003, 2, [
      { platilloId: platilloDoble.id, cantidadPlatillos: 500 }
    ]);
    afirmar(false, 'Debe rechazar venta con stock insuficiente');
  } catch (e: any) {
    afirmar(
      e instanceof ErrorCatalogo && e.codigo === 'STOCK_INSUFICIENTE',
      'CRITERIO CW-06: Venta rechazada con código STOCK_INSUFICIENTE'
    );
    afirmar(e.detalles?.disponible !== undefined, 'Detalles de error incluyen stock disponible');
    afirmar(e.detalles?.demandado !== undefined, 'Detalles de error incluyen stock demandado');
  }

  const stockPanDespuesRechazo = (await CatalogoService.obtenerIngredientePorId(1))!.existencia;
  afirmar(
    stockPanAntesRechazo === stockPanDespuesRechazo,
    'CRITERIO CW-06: Rechazo no dejó escrituras parciales ni modificó las existencias'
  );

  // -------------------------------------------------------------------------
  // 6. Historial de Kárdex y Auditoría
  // -------------------------------------------------------------------------
  console.log('\n📜 6. Historial de Kárdex de Movimientos:');

  const movimientosPan = await InventarioService.listarMovimientos(1);
  afirmar(movimientosPan.length > 0, 'Se listan movimientos del Pan');

  const consumoReciente = movimientosPan.find((m) => m.tipo === 'CONSUMO_VENTA');
  afirmar(consumoReciente !== undefined, 'Existe registro de CONSUMO_VENTA');
  afirmar(consumoReciente!.ordenId === 1002 || consumoReciente!.ordenId === 1001, 'Conserva ordenId de venta');
  afirmar(consumoReciente!.cantidad.startsWith('-'), 'Cantidad de consumo tiene signo negativo');
  afirmar(consumoReciente!.creadoEn.includes('T'), 'Fecha formateada en estándar UTC ISO 8601');

  // -------------------------------------------------------------------------
  // Resumen Final
  // -------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`🏁 RESULTADO DE PRUEBAS W2-03: ${pruebasPasadas}/${pruebasTotales} EXITOSAS`);
  console.log('===============================================================\n');
}

ejecutarPruebasInventario().catch((err) => {
  console.error('❌ Error fatal en pruebas de inventario:', err);
  process.exit(1);
});
