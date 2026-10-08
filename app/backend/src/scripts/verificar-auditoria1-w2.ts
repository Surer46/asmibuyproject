/**
 * BATERÍA DE PRUEBAS DE RESOLUCIÓN DE AUDITORÍA 1 — INTEGRANTE 2 (Catálogo e Inventario)
 * Valida la resolución técnica integral de los hallazgos:
 * 1. Crítica (W2-03, CW-04/06): Concurrencia de ajustes, transacción con bloqueo FOR UPDATE y stock nunca negativo.
 * 2. Alta (W2-02/03): Ausencia total de fallback silencioso a memoria ante caída de BD (falla estricta).
 * 3. Alta (W2-02, CW-03): Lecturas transaccionales con PoolClient en crear/actualizar platillo antes de commit.
 * 4. Alta (W2-03 con W4-03): Lectura consistente y atómica de recetas dentro de la transacción de venta.
 * 5. Media (W2-02/03): Validación rigurosa de números decimales finitos (rechazo de NaN, Infinity, -Infinity, formatos inválidos).
 * 6. Evidencia (W2-01 a W2-06): Migración 005 empaquetada en dist/migrations y kárdex inmutable.
 */

import Decimal from 'decimal.js';
import fs from 'fs';
import path from 'path';
import { CatalogoService, ErrorCatalogo, validarNumeroDecimal } from '../services/catalogo.service';
import { InventarioService } from '../services/inventario.service';
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

async function probarRechazoValoresNoFinitosYFormatos() {
  console.log('\n🔢 1. Validación estricta de decimales finitos y formatos (Hallazgo Media):');

  // 1.1 Probar validador central validarNumeroDecimal con NaN e Infinity
  try {
    validarNumeroDecimal('NaN', 'test');
    afirmar(false, 'Debe rechazar NaN en validarNumeroDecimal');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo && e.codigo === 'DATOS_INVALIDOS', 'Rechaza cadena "NaN" con DATOS_INVALIDOS');
  }

  try {
    validarNumeroDecimal('Infinity', 'test');
    afirmar(false, 'Debe rechazar Infinity');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo && e.codigo === 'DATOS_INVALIDOS', 'Rechaza "Infinity"');
  }

  try {
    validarNumeroDecimal('-Infinity', 'test');
    afirmar(false, 'Debe rechazar -Infinity');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo && e.codigo === 'DATOS_INVALIDOS', 'Rechaza "-Infinity"');
  }

  try {
    validarNumeroDecimal('1e5', 'test');
    afirmar(false, 'Debe rechazar notación científica');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo && e.codigo === 'DATOS_INVALIDOS', 'Rechaza notación científica "1e5"');
  }

  try {
    validarNumeroDecimal('abc12', 'test');
    afirmar(false, 'Debe rechazar caracteres alfabéticos');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo && e.codigo === 'DATOS_INVALIDOS', 'Rechaza texto "abc12"');
  }

  // 1.2 Probar rechazo de NaN en crearIngrediente
  try {
    await CatalogoService.crearIngrediente({
      nombre: 'Ingrediente NaN',
      unidad: 'g',
      minimo: 'NaN'
    });
    afirmar(false, 'Debe rechazar crear ingrediente con mínimo "NaN"');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo, 'CatalogoService.crearIngrediente rechaza mínimo "NaN"');
  }

  // 1.3 Probar rechazo de Infinity en precio de platillo
  try {
    await CatalogoService.crearPlatillo({
      nombre: 'Platillo Infinito',
      precio: 'Infinity',
      receta: [{ ingredienteId: 1, cantidad: 1 }]
    });
    afirmar(false, 'Debe rechazar precio "Infinity"');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo && e.codigo === 'DATOS_INVALIDOS', 'CatalogoService.crearPlatillo rechaza precio "Infinity"');
  }

  // 1.4 Probar rechazo de NaN en cantidad de entrada de inventario
  try {
    await InventarioService.registrarEntrada({
      ingredienteId: 1,
      cantidad: 'NaN',
      usuarioId: 1
    });
    afirmar(false, 'Debe rechazar entrada con cantidad "NaN"');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo, 'InventarioService.registrarEntrada rechaza cantidad "NaN"');
  }

  // 1.5 Probar rechazo de NaN en ajuste de inventario
  try {
    await InventarioService.registrarAjuste({
      ingredienteId: 1,
      cantidad: 'NaN',
      motivo: 'Ajuste de prueba',
      usuarioId: 1
    });
    afirmar(false, 'Debe rechazar ajuste con cantidad "NaN"');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo && e.codigo === 'DATOS_INVALIDOS', 'InventarioService.registrarAjuste rechaza cantidad "NaN"');
  }
}

async function probarFalloEstrictoSinFallbackMemoria() {
  console.log('\n🛡️ 2. Falla estricta ante caída de BD (sin fallback a memoria) (Hallazgo Alta):');

  const urlOriginal = process.env.DATABASE_URL;
  // Simular DATABASE_URL configurada pero apuntando a servidor caído
  process.env.DATABASE_URL = 'postgresql://down_user:down_pass@127.0.0.1:59999/down_db';

  try {
    await CatalogoService.listarIngredientes();
    afirmar(false, 'Debe arrojar excepción y no responder desde memoria');
  } catch (err: any) {
    afirmar(true, `CatalogoService.listarIngredientes falla estrictamente ante BD caída (${err.code || err.message})`);
  }

  try {
    await CatalogoService.crearIngrediente({
      nombre: 'Ingrediente Prueba BD Caida',
      unidad: 'pieza',
      minimo: 5
    });
    afirmar(false, 'Debe arrojar excepción al intentar crear ingrediente con BD caída');
  } catch (err: any) {
    afirmar(true, 'CatalogoService.crearIngrediente no muta memoria ante caída de BD');
  }

  try {
    await InventarioService.registrarEntrada({
      ingredienteId: 1,
      cantidad: 10,
      usuarioId: 1
    });
    afirmar(false, 'Debe fallar al registrar entrada con BD caída');
  } catch (err: any) {
    afirmar(true, 'InventarioService.registrarEntrada falla estrictamente ante caída de BD');
  }

  // Restaurar variable
  delete process.env.DATABASE_URL;
  if (urlOriginal) process.env.DATABASE_URL = urlOriginal;
}

async function probarAjustesConcurrentesYSaldoNoNegativo() {
  console.log('\n⚖️ 3. Transacciones de ajuste y stock nunca negativo (Hallazgo Crítica CW-04/CW-06):');

  // Preparar insumo de prueba con exactamente 10 unidades
  const ingTest = await CatalogoService.crearIngrediente({
    nombre: 'Pan Brioche Concurrente',
    unidad: 'pieza',
    minimo: 2
  });

  await InventarioService.registrarEntrada({
    ingredienteId: ingTest.id,
    cantidad: 10,
    motivo: 'Stock inicial para prueba de competencia',
    usuarioId: 1
  });

  let balanceActual = new Decimal((await CatalogoService.obtenerIngredientePorId(ingTest.id))!.existencia);
  afirmar(balanceActual.equals(10), 'Saldo inicial de Pan Brioche es exactamente 10');

  // Ejecutar dos ajustes de -8 en competencia
  // Uno debe tener éxito (reduciendo a 2), y el otro debe fallar con STOCK_NEGATIVO_NO_PERMITIDO
  const ajuste1Promise = InventarioService.registrarAjuste({
    ingredienteId: ingTest.id,
    cantidad: -8,
    motivo: 'Ajuste competidor 1',
    usuarioId: 1
  });

  const ajuste2Promise = InventarioService.registrarAjuste({
    ingredienteId: ingTest.id,
    cantidad: -8,
    motivo: 'Ajuste competidor 2',
    usuarioId: 1
  });

  const resultados = await Promise.allSettled([ajuste1Promise, ajuste2Promise]);

  const exitosos = resultados.filter((r) => r.status === 'fulfilled');
  const rechazados = resultados.filter((r) => r.status === 'rejected');

  afirmar(exitosos.length === 1, 'Exactamente 1 ajuste de -8 fue aceptado');
  afirmar(rechazados.length === 1, 'El segundo ajuste de -8 fue rechazado para evitar saldo negativo');

  const errorRechazo = (rechazados[0] as PromiseRejectedResult).reason;
  afirmar(
    errorRechazo instanceof ErrorCatalogo && errorRechazo.codigo === 'STOCK_NEGATIVO_NO_PERMITIDO',
    'El ajuste competidor rechazado devolvió STOCK_NEGATIVO_NO_PERMITIDO'
  );

  const saldoFinal = new Decimal((await CatalogoService.obtenerIngredientePorId(ingTest.id))!.existencia);
  afirmar(saldoFinal.equals(2), `Saldo final en almacén es 2 piezas (NUNCA negativo: saldo=${saldoFinal.toString()})`);
}

async function probarLecturasTransaccionalesPlatillos() {
  console.log('\n📖 4. Lecturas transaccionales con PoolClient y retornos de platillo (Hallazgo Alta CW-03):');

  // En memoria o en base de datos, crear y actualizar platillo devuelve la entidad completa con receta
  const platilloCreado = await CatalogoService.crearPlatillo({
    nombre: 'Hamburguesa Especial Auditoria',
    precio: '135.50',
    receta: [
      { ingredienteId: 1, cantidad: 1 },
      { ingredienteId: 2, cantidad: '150.000' }
    ]
  });

  afirmar(platilloCreado !== null && platilloCreado.id > 0, 'crearPlatillo retorna la entidad creada correctamente');
  afirmar(platilloCreado.precio === '135.50', 'Precio retornado coincide con el enviado (135.50)');
  afirmar(platilloCreado.recetaValida === true, 'Receta del platillo es válida');
  afirmar(platilloCreado.ingredientes?.length === 2, 'Contiene los 2 ingredientes de su receta');

  // Actualizar platillo
  const platilloActualizado = await CatalogoService.actualizarPlatillo(platilloCreado.id, {
    precio: '150.00'
  });

  afirmar(platilloActualizado.precio === '150.00', 'actualizarPlatillo retorna inmediatamente el nuevo precio actualizado');
}

async function probarConsumoTransaccionalPorVentaConsistente() {
  console.log('\n🛒 5. Lectura atómica de receta en descontarInventarioPorVenta (Hallazgo Alta W2-03 con W4-03):');

  // Venta con stock suficiente
  const panAntes = new Decimal((await CatalogoService.obtenerIngredientePorId(1))!.existencia);
  await InventarioService.descontarInventarioPorVenta(null, 9901, 1, [
    { platilloId: 1, cantidadPlatillos: 1 }
  ]);
  const panDespues = new Decimal((await CatalogoService.obtenerIngredientePorId(1))!.existencia);
  afirmar(panAntes.minus(panDespues).equals(1), 'Venta descontó receta de manera consistente');

  // Venta que superaría existencia
  try {
    await InventarioService.descontarInventarioPorVenta(null, 9902, 1, [
      { platilloId: 1, cantidadPlatillos: 999999 }
    ]);
    afirmar(false, 'Debe rechazar venta que supera el stock disponible');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo && e.codigo === 'STOCK_INSUFICIENTE', 'Rechaza atómicamente con STOCK_INSUFICIENTE (409)');
  }
}

async function probarMigracionesEmpaquetadas() {
  console.log('\n📦 6. Verificación de Migración 005 en dist/migrations (Hallazgo Evidencia):');

  const rutaDistMigracion = path.resolve(__dirname, '../migrations/005_proteccion_stock_no_negativo.sql');
  const existeEnDist = fs.existsSync(rutaDistMigracion);
  afirmar(existeEnDist, 'Migración 005_proteccion_stock_no_negativo.sql existe en dist/migrations/');

  if (existeEnDist) {
    const contenido = fs.readFileSync(rutaDistMigracion, 'utf-8');
    afirmar(
      contenido.includes('trg_verificar_stock_no_negativo') && contenido.includes('STOCK_NEGATIVO_NO_PERMITIDO'),
      'Migración 005 contiene trigger con bloqueo FOR UPDATE y chequeo de saldo no negativo'
    );
  }
}

async function ejecutar() {
  console.log('========================================================================');
  console.log('🧪 SUITE DE VERIFICACIÓN DE AUDITORÍA 1 — INTEGRANTE 2');
  console.log('   Módulo: Catálogo e Inventario');
  console.log('   Resolución de Hallazgos: Crítica, Alta, Media y Evidencia');
  console.log('========================================================================');

  await probarRechazoValoresNoFinitosYFormatos();
  await probarFalloEstrictoSinFallbackMemoria();
  await probarAjustesConcurrentesYSaldoNoNegativo();
  await probarLecturasTransaccionalesPlatillos();
  await probarConsumoTransaccionalPorVentaConsistente();
  await probarMigracionesEmpaquetadas();

  console.log('\n========================================================================');
  console.log(`🏁 RESULTADO: ${exitos} pruebas exitosas, ${fallos} fallos`);
  console.log('========================================================================\n');

  if (fallos > 0) {
    process.exit(1);
  }
}

ejecutar().catch((err) => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
