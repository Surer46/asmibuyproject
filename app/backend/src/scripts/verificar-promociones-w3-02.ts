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
  console.log('===============================================================');
  console.log('🧪 BATERÍA DE PRUEBAS DE VERIFICACIÓN - TAREA W3-02');
  console.log('   Módulo: Descuentos y Promociones (Integrante 3)');
  console.log('   Alcance: Creación, Edición, Validación, Vigencias y Retiro');
  console.log('===============================================================\n');

  // Asegurar que exista un platillo en memoria para pruebas
  if (almacenMemoria.platillos.length === 0) {
    almacenMemoria.platillos.push({
      id: 1,
      nombre: 'Hamburguesa Clásica',
      precio: new Decimal('100.00'),
      activo: true
    });
  }

  // 1. Verificación de Validación de Parámetros
  console.log('📋 1. Verificación de Validación de Parámetros:');
  try {
    PromocionesService.validarParametros({
      nombre: '',
      platilloId: 1,
      tipo: 'PORCENTAJE',
      porcentaje: 15,
      duracion: 'PERMANENTE'
    });
    assert(false, 'Debe rechazar nombre vacío');
  } catch (e: any) {
    assert(e.codigo === 'PARAMETROS_INVALIDOS', 'Rechaza nombre vacío');
  }

  try {
    PromocionesService.validarParametros({
      nombre: 'Promo Test',
      platilloId: 0,
      tipo: 'PORCENTAJE',
      porcentaje: 15,
      duracion: 'PERMANENTE'
    });
    assert(false, 'Debe rechazar platilloId menor o igual a 0');
  } catch (e: any) {
    assert(e.codigo === 'PARAMETROS_INVALIDOS', 'Rechaza platilloId inválido (<= 0)');
  }

  try {
    PromocionesService.validarParametros({
      nombre: 'Promo Test',
      platilloId: 1,
      tipo: 'DESCUENTO_FIJO' as any,
      porcentaje: 15,
      duracion: 'PERMANENTE'
    });
    assert(false, 'Debe rechazar tipo no reconocido');
  } catch (e: any) {
    assert(e.codigo === 'TIPO_PROMOCION_INVALIDO', 'Rechaza tipo inválido fuera de PORCENTAJE/NXM');
  }

  // 2. Parámetros de Porcentaje (CW-11)
  console.log('\n🔢 2. Validación de Parámetros de Porcentaje (CW-11):');
  try {
    PromocionesService.validarParametros({
      nombre: 'Promo 0%',
      platilloId: 1,
      tipo: 'PORCENTAJE',
      porcentaje: 0,
      duracion: 'PERMANENTE'
    });
    assert(false, 'Debe rechazar porcentaje igual a 0');
  } catch (e: any) {
    assert(e.codigo === 'PORCENTAJE_INVALIDO', 'Rechaza porcentaje igual a 0');
  }

  try {
    PromocionesService.validarParametros({
      nombre: 'Promo 150%',
      platilloId: 1,
      tipo: 'PORCENTAJE',
      porcentaje: 150,
      duracion: 'PERMANENTE'
    });
    assert(false, 'Debe rechazar porcentaje superior a 100');
  } catch (e: any) {
    assert(e.codigo === 'PORCENTAJE_INVALIDO', 'Rechaza porcentaje mayor a 100');
  }

  try {
    PromocionesService.validarParametros({
      nombre: 'Promo 3 decimales',
      platilloId: 1,
      tipo: 'PORCENTAJE',
      porcentaje: '15.999',
      duracion: 'PERMANENTE'
    });
    assert(false, 'Debe rechazar porcentaje con más de 2 decimales');
  } catch (e: any) {
    assert(e.codigo === 'PORCENTAJE_INVALIDO', 'Rechaza porcentaje con más de 2 decimales');
  }

  // 3. Parámetros NxM (CW-12)
  console.log('\n🍔 3. Validación de Parámetros NxM (CW-12):');
  try {
    PromocionesService.validarParametros({
      nombre: 'Promo 1x1',
      platilloId: 1,
      tipo: 'NXM',
      n: 1,
      m: 1,
      duracion: 'PERMANENTE'
    });
    assert(false, 'Debe rechazar N <= M');
  } catch (e: any) {
    assert(e.codigo === 'NXM_INVALIDO', 'Rechaza N <= M (1x1 no es una promoción)');
  }

  try {
    PromocionesService.validarParametros({
      nombre: 'Promo 2x0',
      platilloId: 1,
      tipo: 'NXM',
      n: 2,
      m: 0,
      duracion: 'PERMANENTE'
    });
    assert(false, 'Debe rechazar M < 1');
  } catch (e: any) {
    assert(e.codigo === 'NXM_INVALIDO', 'Rechaza M < 1');
  }

  try {
    PromocionesService.validarParametros({
      nombre: 'Promo Decimal NxM',
      platilloId: 1,
      tipo: 'NXM',
      n: 2.5,
      m: 1,
      duracion: 'PERMANENTE'
    });
    assert(false, 'Debe rechazar N no entero');
  } catch (e: any) {
    assert(e.codigo === 'NXM_INVALIDO', 'Rechaza N o M fraccionarios');
  }

  // 4. Validación de Duración y Vigencia (CW-10)
  console.log('\n⏳ 4. Validación de Duración y Vigencia (CW-10):');
  try {
    PromocionesService.validarParametros({
      nombre: 'Temporal sin fechas',
      platilloId: 1,
      tipo: 'PORCENTAJE',
      porcentaje: 20,
      duracion: 'TEMPORAL'
    });
    assert(false, 'Debe rechazar temporal sin fechas');
  } catch (e: any) {
    assert(e.codigo === 'VIGENCIA_INVALIDA', 'Rechaza temporal sin fechas de inicio y fin');
  }

  try {
    PromocionesService.validarParametros({
      nombre: 'Temporal invertida',
      platilloId: 1,
      tipo: 'PORCENTAJE',
      porcentaje: 20,
      duracion: 'TEMPORAL',
      fechaInicio: '2026-09-30T10:00:00.000Z',
      fechaFin: '2026-09-29T10:00:00.000Z'
    });
    assert(false, 'Debe rechazar fechaInicio >= fechaFin');
  } catch (e: any) {
    assert(e.codigo === 'VIGENCIA_INVALIDA', 'Rechaza fecha inicio posterior a fecha fin');
  }

  try {
    PromocionesService.validarParametros({
      nombre: 'Permanente con fechas',
      platilloId: 1,
      tipo: 'PORCENTAJE',
      porcentaje: 20,
      duracion: 'PERMANENTE',
      fechaInicio: '2026-09-28T10:00:00.000Z'
    });
    assert(false, 'Debe rechazar permanente con fechas');
  } catch (e: any) {
    assert(e.codigo === 'PARAMETROS_INVALIDOS', 'Rechaza parámetros de fecha en promoción permanente');
  }

  // 5. Creación y Ciclo de Vida Operativo
  console.log('\n🚀 5. Creación y Ciclo de Vida de Promociones:');
  const promoPermanente = await PromocionesService.crearPromocion(
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

  assert(promoPermanente.id > 0, `Promoción creada con ID ${promoPermanente.id}`);
  assert(promoPermanente.tipo === 'NXM', 'Tipo correcto NXM');
  assert(promoPermanente.n === 2 && promoPermanente.m === 1, 'Parámetros N=2 y M=1 exactos');
  assert(promoPermanente.duracion === 'PERMANENTE', 'Duración PERMANENTE');
  assert(promoPermanente.estado === 'ACTIVA', 'Inicia en estado ACTIVA');
  assert(promoPermanente.vigente === true, 'Vigencia activa calculada');

  // Suspender / Desactivar
  const desactivada = await PromocionesService.cambiarEstado(promoPermanente.id, 'INACTIVA', 1);
  assert(desactivada.estado === 'INACTIVA', 'Estado cambiado a INACTIVA');
  assert(desactivada.vigente === false, 'Vigencia inactiva cuando está suspendida');

  // Reactivar
  const reactivada = await PromocionesService.cambiarEstado(promoPermanente.id, 'ACTIVA', 1);
  assert(reactivada.estado === 'ACTIVA', 'Reactivada a ACTIVA');
  assert(reactivada.vigente === true, 'Vuelve a estar vigente');

  // Modificar datos
  const editada = await PromocionesService.actualizarPromocion(
    promoPermanente.id,
    {
      nombre: 'Martes y Miércoles 2x1 Clásica'
    },
    1
  );
  assert(editada.nombre === 'Martes y Miércoles 2x1 Clásica', 'Nombre actualizado correctamente');

  // Retirar (Baja lógica inmutable)
  const retirada = await PromocionesService.retirarPromocion(promoPermanente.id, 1);
  assert(retirada.estado === 'RETIRADA', 'Promoción marcada como RETIRADA');
  assert(retirada.vigente === false, 'Promoción retirada no es vigente');

  // Intentar modificar una retirada
  try {
    await PromocionesService.actualizarPromocion(promoPermanente.id, { nombre: 'Intento de cambio' }, 1);
    assert(false, 'Debe rechazar modificación de promoción retirada');
  } catch (e: any) {
    assert(e.codigo === 'PROMOCION_RETIRADA', 'Rechaza modificación de promoción en estado RETIRADA');
  }

  // Intentar reactivar una retirada
  try {
    await PromocionesService.cambiarEstado(promoPermanente.id, 'ACTIVA', 1);
    assert(false, 'Debe rechazar reactivación de promoción retirada');
  } catch (e: any) {
    assert(e.codigo === 'PROMOCION_RETIRADA', 'Rechaza reactivación de promoción retirada (inmutabilidad histórica)');
  }

  // 6. Prueba de Promoción Temporal (Inicio inclusivo, fin exclusivo)
  console.log('\n⏱️ 6. Prueba de Vigencia Temporal (Inicio inclusivo, fin exclusivo):');
  const t0 = new Date('2026-09-29T10:00:00.000Z');
  const tFin = new Date('2026-09-29T12:00:00.000Z');

  const promoTemporal = await PromocionesService.crearPromocion(
    {
      nombre: 'Happy Hour 15%',
      platilloId: 1,
      tipo: 'PORCENTAJE',
      porcentaje: 15,
      duracion: 'TEMPORAL',
      fechaInicio: t0.toISOString(),
      fechaFin: tFin.toISOString()
    },
    1
  );

  // Antes de inicio: no vigente
  const tAntes = new Date('2026-09-29T09:59:59.999Z');
  assert(!PromocionesService.estaVigente(promoTemporal, tAntes), 'Antes del inicio no es vigente');

  // En el instante de inicio exacto: VIGENTE (Inicio inclusivo)
  assert(PromocionesService.estaVigente(promoTemporal, t0), 'CRITERIO CW-10: En fecha_inicio exacta es VIGENTE (inclusivo)');

  // Durante la vigencia: VIGENTE
  const tDentro = new Date('2026-09-29T11:00:00.000Z');
  assert(PromocionesService.estaVigente(promoTemporal, tDentro), 'Dentro del intervalo es VIGENTE');

  // Un milisegundo antes de terminar: VIGENTE
  const tCasiFin = new Date('2026-09-29T11:59:59.999Z');
  assert(PromocionesService.estaVigente(promoTemporal, tCasiFin), 'Un ms antes del fin es VIGENTE');

  // En el instante de fin exacto: NO VIGENTE (Fin exclusivo)
  assert(!PromocionesService.estaVigente(promoTemporal, tFin), 'CRITERIO CW-10: En fecha_fin exacta NO es vigente (exclusivo)');

  console.log('\n===============================================================');
  console.log(`🏁 RESULTADO DE PRUEBAS W3-02: ${testsPassed}/${testsPassed + testsFailed} EXITOSAS`);
  console.log('===============================================================');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Error no controlado en pruebas:', err);
  process.exit(1);
});
