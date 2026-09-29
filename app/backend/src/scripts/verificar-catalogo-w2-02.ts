import Decimal from 'decimal.js';
import { CatalogoService, ErrorCatalogo } from '../services/catalogo.service';

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

async function ejecutarPruebas() {
  console.log('===============================================================');
  console.log('🧪 BATERÍA DE PRUEBAS DE VERIFICACIÓN - TAREA W2-02');
  console.log('   Módulo: Catálogo e Inventario (Integrante 2)');
  console.log('   Alcance: Ingredientes, Platillos, Recetas y Reglas de Negocio');
  console.log('===============================================================\n');

  // -------------------------------------------------------------------------
  // 1. Unidades y Mínimos en Ingredientes
  // -------------------------------------------------------------------------
  console.log('📦 1. Verificación de Creación y Validación de Ingredientes:');

  const ing1 = await CatalogoService.crearIngrediente({
    nombre: 'Jitomate Saladet',
    unidad: 'g',
    minimo: '500.000'
  });
  afirmar(ing1.nombre === 'Jitomate Saladet', 'Nombre asignado correctamente');
  afirmar(ing1.unidad === 'g', 'Unidad en gramos');
  afirmar(ing1.minimo === '500.000', 'Mínimo en g formateado con 3 decimales');
  afirmar(ing1.estadoStock === 'AGOTADO', 'Ingrediente nuevo sin movimientos inicia AGOTADO');

  const ing2 = await CatalogoService.crearIngrediente({
    nombre: 'Vaso Desechable 500ml',
    unidad: 'pieza',
    minimo: 10
  });
  afirmar(ing2.minimo === '10', 'Mínimo en piezas formateado como entero');

  // Rechazo de unidad inválida
  try {
    await CatalogoService.crearIngrediente({
      nombre: 'Aceite',
      unidad: 'litros' as any,
      minimo: 1
    });
    afirmar(false, 'Debe rechazar unidad no permitida');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo && e.codigo === 'DATOS_INVALIDOS', 'Rechaza unidad no admitida (litros)');
  }

  // Rechazo de decimales en piezas
  try {
    await CatalogoService.crearIngrediente({
      nombre: 'Cuchara Plástica',
      unidad: 'pieza',
      minimo: '2.5'
    });
    afirmar(false, 'Debe rechazar decimales en unidad pieza');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo && e.codigo === 'CANTIDAD_INVALIDA', 'Rechaza cantidad fraccionaria en pieza (2.5)');
  }

  // Rechazo de mínimo negativo
  try {
    await CatalogoService.crearIngrediente({
      nombre: 'Sal de Mesa',
      unidad: 'g',
      minimo: '-50'
    });
    afirmar(false, 'Debe rechazar mínimo negativo');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo && e.codigo === 'CANTIDAD_INVALIDA', 'Rechaza mínimo negativo (-50)');
  }

  // -------------------------------------------------------------------------
  // 2. Precios y Reglas de Platillos
  // -------------------------------------------------------------------------
  console.log('\n🍔 2. Verificación de Creación y Validación de Platillos y Precios:');

  // Rechazo de precio cero o negativo
  try {
    await CatalogoService.crearPlatillo({
      nombre: 'Combo Cero',
      precio: '0.00',
      receta: [{ ingredienteId: 1, cantidad: 1 }]
    });
    afirmar(false, 'Debe rechazar precio cero');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo && e.codigo === 'DATOS_INVALIDOS', 'Rechaza precio igual a cero');
  }

  // Rechazo de precio con más de 2 decimales
  try {
    await CatalogoService.crearPlatillo({
      nombre: 'Combo Fraccionario',
      precio: '99.999',
      receta: [{ ingredienteId: 1, cantidad: 1 }]
    });
    afirmar(false, 'Debe rechazar precio con 3 decimales');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo && e.codigo === 'DATOS_INVALIDOS', 'Rechaza precio con exceso de precisión decimal (99.999)');
  }

  // Rechazo de receta vacía
  try {
    await CatalogoService.crearPlatillo({
      nombre: 'Platillo Sin Receta',
      precio: '50.00',
      receta: []
    });
    afirmar(false, 'Debe rechazar platillo con receta vacía');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo && e.codigo === 'RECETA_INVALIDA', 'Rechaza platillo con receta vacía (cero ingredientes)');
  }

  // Rechazo de ingredientes duplicados en la misma receta
  try {
    await CatalogoService.crearPlatillo({
      nombre: 'Doble Pan Erróneo',
      precio: '45.00',
      receta: [
        { ingredienteId: 1, cantidad: 1 },
        { ingredienteId: 1, cantidad: 2 }
      ]
    });
    afirmar(false, 'Debe rechazar ingredientes duplicados en receta');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo && e.codigo === 'RECETA_INVALIDA', 'Rechaza ingredientes duplicados en la misma receta');
  }

  // -------------------------------------------------------------------------
  // 3. Garantía CW-03: Crear platillo NO altera movimientos_inventario
  // -------------------------------------------------------------------------
  console.log('\n🛡️ 3. Comprobación de que crear platillo NO altera existencias (CW-03):');

  const conteoMovimientosAntes = CatalogoService.getMovimientosCount();

  const platilloValido = await CatalogoService.crearPlatillo({
    nombre: 'Hamburguesa Doble Especial',
    precio: '165.50',
    receta: [
      { ingredienteId: 1, cantidad: 2 },        // 2 panes
      { ingredienteId: 2, cantidad: '300.000' }, // 300g carne
      { ingredienteId: 3, cantidad: 2 }         // 2 quesos
    ]
  });

  const conteoMovimientosDespues = CatalogoService.getMovimientosCount();

  afirmar(platilloValido.nombre === 'Hamburguesa Doble Especial', 'Platillo creado exitosamente');
  afirmar(platilloValido.precio === '165.50', 'Precio exacto formateado como string con 2 decimales');
  afirmar(platilloValido.recetaValida === true, 'Receta válida');
  afirmar(platilloValido.ingredientes?.length === 3, 'Tiene los 3 ingredientes');
  afirmar(conteoMovimientosAntes === conteoMovimientosDespues, 'CRITERIO CW-03: La creación de receta NO generó movimientos de inventario');

  // -------------------------------------------------------------------------
  // 4. Inmutabilidad de la Unidad con Referencias
  // -------------------------------------------------------------------------
  console.log('\n🔒 4. Verificación de Inmutabilidad de Unidad con Referencias:');

  try {
    // Intentar cambiar la unidad de 'Pan de Hamburguesa' (id: 1, usado en recetas) de 'pieza' a 'g'
    await CatalogoService.actualizarIngrediente(1, { unidad: 'g' });
    afirmar(false, 'Debe rechazar cambio de unidad');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo && e.codigo === 'UNIDAD_INMUTABLE', 'Rechaza cambio de unidad cuando el ingrediente tiene referencias');
  }

  // -------------------------------------------------------------------------
  // 5. Rechazo de Ingredientes Inactivos en Recetas
  // -------------------------------------------------------------------------
  console.log('\n🚫 5. Verificación de Ingredientes Inactivos:');

  const ingInactivo = await CatalogoService.crearIngrediente({
    nombre: 'Aderezo Descontinuado',
    unidad: 'ml',
    minimo: '0.000'
  });
  await CatalogoService.actualizarIngrediente(ingInactivo.id, { activo: false });

  try {
    await CatalogoService.crearPlatillo({
      nombre: 'Hamburguesa Con Aderezo Inactivo',
      precio: '130.00',
      receta: [{ ingredienteId: ingInactivo.id, cantidad: '30.000' }]
    });
    afirmar(false, 'Debe rechazar ingrediente inactivo');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo && e.codigo === 'INGREDIENTE_INACTIVO', 'Rechaza uso de ingrediente inactivo en receta');
  }

  // -------------------------------------------------------------------------
  // 6. Impedir Desactivación de Ingrediente en Uso Activo
  // -------------------------------------------------------------------------
  console.log('\n⚠️ 6. Impedir desactivación de ingrediente usado en platillos activos:');

  try {
    // Intentar desactivar 'Carne de Res' (id: 2, usado en Hamburguesa Clásica activa)
    await CatalogoService.actualizarIngrediente(2, { activo: false });
    afirmar(false, 'Debe rechazar desactivación de ingrediente en uso');
  } catch (e: any) {
    afirmar(e instanceof ErrorCatalogo && e.codigo === 'INGREDIENTE_EN_USO', 'Rechaza desactivar ingrediente referenciado en platillos activos');
  }

  // -------------------------------------------------------------------------
  // 7. Modificar Receta NO Altera Existencias
  // -------------------------------------------------------------------------
  console.log('\n🔄 7. Actualización de Receta y Conservación de Existencias:');

  const conteoMovimientosAntesReceta = CatalogoService.getMovimientosCount();

  const platilloModificado = await CatalogoService.actualizarPlatillo(platilloValido.id, {
    receta: [
      { ingredienteId: 1, cantidad: 1 },        // Cambiado a 1 pan
      { ingredienteId: 2, cantidad: '150.000' }  // Cambiado a 150g
    ]
  });

  const conteoMovimientosDespuesReceta = CatalogoService.getMovimientosCount();

  afirmar(platilloModificado.ingredientes?.length === 2, 'Receta actualizada con 2 ingredientes');
  afirmar(conteoMovimientosAntesReceta === conteoMovimientosDespuesReceta, 'Actualizar receta NO modificó existencias de inventario');

  // -------------------------------------------------------------------------
  // Resumen Final
  // -------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`🏁 RESULTADO DE PRUEBAS W2-02: ${pruebasPasadas}/${pruebasTotales} EXITOSAS`);
  console.log('===============================================================\n');
}

ejecutarPruebas().catch((err) => {
  console.error('❌ Error fatal en pruebas:', err);
  process.exit(1);
});
