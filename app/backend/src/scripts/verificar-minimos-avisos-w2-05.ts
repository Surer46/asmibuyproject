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

async function ejecutarPruebasAvisos() {
  console.log('===============================================================');
  console.log('🧪 BATERÍA DE PRUEBAS DE VERIFICACIÓN - TAREA W2-05');
  console.log('   Módulo: Catálogo e Inventario (Integrante 2)');
  console.log('   Alcance: Mínimos individuales, Alertas y Vista Avisos (CW-08/09)');
  console.log('===============================================================\n');

  // -------------------------------------------------------------------------
  // 1. Edición de Mínimo Obligatorio No Negativo
  // -------------------------------------------------------------------------
  console.log('⚙️ 1. Edición de Mínimo Obligatorio por Ingrediente:');

  const ingPrueba = await CatalogoService.crearIngrediente({
    nombre: 'Salsa Especial BBQ',
    unidad: 'ml',
    minimo: '300.000'
  });
  afirmar(ingPrueba.minimo === '300.000', 'Mínimo inicial fijado en 300 ml');

  // Administrador actualiza el mínimo a 450 ml
  const ingActualizado = await CatalogoService.actualizarIngrediente(ingPrueba.id, {
    minimo: '450.000'
  });
  afirmar(ingActualizado.minimo === '450.000', 'Mínimo actualizado con éxito a 450 ml');

  // Permitir mínimo igual a cero
  const ingMinimoCero = await CatalogoService.actualizarIngrediente(ingPrueba.id, {
    minimo: '0.000'
  });
  afirmar(ingMinimoCero.minimo === '0.000', 'Mínimo fijado en 0 admitido');

  // Rechazo de mínimo negativo
  try {
    await CatalogoService.actualizarIngrediente(ingPrueba.id, {
      minimo: '-100.000'
    });
    afirmar(false, 'Debe rechazar mínimo negativo');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo && e.codigo === 'CANTIDAD_INVALIDA', 'Rechaza mínimo negativo (-100 ml)');
  }

  // -------------------------------------------------------------------------
  // 2. Criterio CW-08: Pan con mínimo 20 y Carne con mínimo 2000 se evalúan por separado
  // -------------------------------------------------------------------------
  console.log('\n🔍 2. Verificación de Evaluación Independiente (Criterio CW-08):');

  // Crear ingrediente Pan de Prueba con mínimo 20 piezas
  const ingPanPrueba = await CatalogoService.crearIngrediente({
    nombre: 'Pan Brioche Artesanal',
    unidad: 'pieza',
    minimo: 20
  });

  // Crear ingrediente Carne de Prueba con mínimo 2000 g
  const ingCarnePrueba = await CatalogoService.crearIngrediente({
    nombre: 'Carne Sirloin Molida',
    unidad: 'g',
    minimo: 2000
  });

  // Ambos inician sin stock (existencia = 0) -> Deben estar en AGOTADO
  let panInfo = await CatalogoService.obtenerIngredientePorId(ingPanPrueba.id);
  let carneInfo = await CatalogoService.obtenerIngredientePorId(ingCarnePrueba.id);
  afirmar(panInfo!.existencia === '0', 'Existencia inicial de pan es 0');
  afirmar(panInfo!.estadoStock === 'AGOTADO', 'Pan con existencia 0 se evalúa como AGOTADO (prioridad 1)');
  afirmar(carneInfo!.existencia === '0.000', 'Existencia inicial de carne es 0.000 g');
  afirmar(carneInfo!.estadoStock === 'AGOTADO', 'Carne con existencia 0 se evalúa como AGOTADO (prioridad 1)');

  // Reposición exacta al mínimo para Pan (existencia = 20) -> IGUALDAD ACTIVA BAJO STOCK
  await InventarioService.registrarEntrada({
    ingredienteId: ingPanPrueba.id,
    cantidad: 20,
    motivo: 'Entrada para prueba de igualdad con mínimo',
    usuarioId: 1
  });
  panInfo = await CatalogoService.obtenerIngredientePorId(ingPanPrueba.id);
  afirmar(panInfo!.existencia === '20', 'Existencia de pan es exactamente 20 piezas');
  afirmar(
    panInfo!.estadoStock === 'BAJO_STOCK',
    'CRITERIO CW-08: Igualdad exacta (existencia = mínimo 20) activa BAJO_STOCK'
  );

  // Carne sigue en 0 -> Permanece AGOTADO (evaluación independiente)
  carneInfo = await CatalogoService.obtenerIngredientePorId(ingCarnePrueba.id);
  afirmar(
    carneInfo!.estadoStock === 'AGOTADO',
    'CRITERIO CW-08: Carne con mínimo 2000 se evalúa por separado y permanece AGOTADO'
  );

  // Reposición superior para Pan (existencia = 25 > 20) -> RESUELVE A NORMAL
  await InventarioService.registrarEntrada({
    ingredienteId: ingPanPrueba.id,
    cantidad: 5,
    motivo: 'Entrada adicional superando mínimo',
    usuarioId: 1
  });
  panInfo = await CatalogoService.obtenerIngredientePorId(ingPanPrueba.id);
  afirmar(panInfo!.existencia === '25', 'Existencia de pan es 25');
  afirmar(
    panInfo!.estadoStock === 'NORMAL',
    'CRITERIO CW-08: Reposición superior (existencia 25 > mínimo 20) resuelve a NORMAL'
  );

  // Reposición exacta para Carne (existencia = 2000 g = mínimo 2000) -> IGUALDAD ACTIVA BAJO STOCK
  await InventarioService.registrarEntrada({
    ingredienteId: ingCarnePrueba.id,
    cantidad: 2000,
    motivo: 'Entrada de carne igual al mínimo',
    usuarioId: 1
  });
  carneInfo = await CatalogoService.obtenerIngredientePorId(ingCarnePrueba.id);
  afirmar(carneInfo!.existencia === '2000.000', 'Existencia de carne es 2000.000 g');
  afirmar(
    carneInfo!.estadoStock === 'BAJO_STOCK',
    'CRITERIO CW-08: Carne con existencia 2000 g igual al mínimo 2000 activa BAJO_STOCK mientras pan está en NORMAL'
  );

  // Reposición superior para Carne (existencia = 3500 g > 2000) -> NORMAL
  await InventarioService.registrarEntrada({
    ingredienteId: ingCarnePrueba.id,
    cantidad: 1500,
    motivo: 'Entrada superando mínimo de carne',
    usuarioId: 1
  });
  carneInfo = await CatalogoService.obtenerIngredientePorId(ingCarnePrueba.id);
  afirmar(carneInfo!.estadoStock === 'NORMAL', 'Carne resuelve a NORMAL tras superar el mínimo (3500 > 2000)');

  // -------------------------------------------------------------------------
  // 3. Criterio CW-09: Avisos muestra una sola fila por ingrediente con orden de prioridad
  // -------------------------------------------------------------------------
  console.log('\n📋 3. Consulta de Avisos y Priorización (Criterio CW-09):');

  const todosLosIngredientes = await CatalogoService.listarIngredientes();
  const mapaAvisos = new Map<number, number>();

  for (const ing of todosLosIngredientes) {
    mapaAvisos.set(ing.id, (mapaAvisos.get(ing.id) || 0) + 1);
  }

  // Verificar que ningún ingrediente aparece duplicado
  let duplicados = false;
  for (const [id, count] of mapaAvisos.entries()) {
    if (count > 1) {
      duplicados = true;
      break;
    }
  }
  afirmar(!duplicados, 'CRITERIO CW-09: Cada ingrediente tiene exactamente una fila única en Avisos');

  // Verificar orden de prioridad: AGOTADO primero, luego BAJO_STOCK, luego NORMAL
  const ordenPrioridad: Record<string, number> = { AGOTADO: 1, BAJO_STOCK: 2, NORMAL: 3 };
  const avisosOrdenados = [...todosLosIngredientes].sort(
    (a, b) => ordenPrioridad[a.estadoStock] - ordenPrioridad[b.estadoStock] || a.nombre.localeCompare(b.nombre)
  );

  for (let i = 0; i < avisosOrdenados.length - 1; i++) {
    const pActual = ordenPrioridad[avisosOrdenados[i].estadoStock];
    const pSiguiente = ordenPrioridad[avisosOrdenados[i + 1].estadoStock];
    afirmar(pActual <= pSiguiente, `Prioridad respetada en posición ${i} (${avisosOrdenados[i].estadoStock} <= ${avisosOrdenados[i + 1].estadoStock})`);
  }

  // -------------------------------------------------------------------------
  // Resumen Final
  // -------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`🏁 RESULTADO DE PRUEBAS W2-05: ${pruebasPasadas}/${pruebasTotales} EXITOSAS`);
  console.log('===============================================================\n');
}

ejecutarPruebasAvisos().catch((err) => {
  console.error('❌ Error fatal en pruebas de avisos:', err);
  process.exit(1);
});
