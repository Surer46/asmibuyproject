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
  console.log('🧪 BATERÍA DE PRUEBAS DE CÁLCULO EXACTO - TAREA W3-03');
  console.log('   Módulo: Descuentos y Promociones (Integrante 3)');
  console.log('   Alcance: Aritmética decimal.js, Redondeo Half-Up, NxM y CW-13');
  console.log('===============================================================\n');

  // Inicializar catálogo en memoria
  almacenMemoria.platillos = [
    { id: 1, nombre: 'Hamburguesa Clásica', precio: new Decimal('100.00'), activo: true },
    { id: 2, nombre: 'Papas Fritas', precio: new Decimal('50.00'), activo: true },
    { id: 3, nombre: 'Refresco', precio: new Decimal('33.33'), activo: true }
  ];
  almacenMemoria.promociones = [];
  almacenMemoria.proxPromocionId = 1;

  // 1. Verificación de Cálculo Porcentual (CW-11)
  console.log('🔢 1. Cálculo de Porcentaje y Redondeo Half-Up (CW-11):');

  // Caso 1: 2 unidades de 100 al 15% -> Subtotal 200, Ahorro 30, Total 170
  const calc15 = PromocionesService.calcularAhorroDePromocion(
    { tipo: 'PORCENTAJE', porcentaje: new Decimal('15'), n: null, m: null },
    new Decimal('100.00'),
    2
  );
  assert(calc15.ahorro.equals(30), 'CRITERIO CW-11: 2 unidades de $100 al 15% genera ahorro exacto de $30.00');
  assert(calc15.unidadesCobradas === 2, 'Unidades cobradas son 2');
  assert(calc15.unidadesBonificadas === 0, 'Unidades bonificadas son 0');

  // Caso 2: Redondeo mitad hacia arriba con centavos: 1 unidad de 33.33 al 15%
  // 33.33 * 0.15 = 4.9995 -> Redondeo half-up a 2 decimales debe ser 5.00
  const calcCentavos = PromocionesService.calcularAhorroDePromocion(
    { tipo: 'PORCENTAJE', porcentaje: new Decimal('15'), n: null, m: null },
    new Decimal('33.33'),
    1
  );
  assert(calcCentavos.ahorro.equals(5), 'Redondeo Half-Up exacto: $33.33 al 15% (4.9995) redondea a $5.00');

  // Caso 3: Descuento 100% -> Ahorro total, importe neto cero
  const calc100 = PromocionesService.calcularAhorroDePromocion(
    { tipo: 'PORCENTAJE', porcentaje: new Decimal('100'), n: null, m: null },
    new Decimal('100.00'),
    1
  );
  assert(calc100.ahorro.equals(100), 'CRITERIO CW-11: Descuento de 100% produce ahorro completo de $100.00');

  // 2. Verificación de Cálculo NxM con Grupos y Sobrantes (CW-12)
  console.log('\n🍔 2. Cálculo NxM con Grupos y Sobrantes (CW-12):');

  // Caso 1: 5 unidades de 100 en 2x1 -> Cobran 3 (300), Ahorro 2 (200), Entregadas 5
  const calc2x1 = PromocionesService.calcularAhorroDePromocion(
    { tipo: 'NXM', porcentaje: null, n: 2, m: 1 },
    new Decimal('100.00'),
    5
  );
  assert(calc2x1.unidadesCobradas === 3, 'CRITERIO CW-12: 5 unidades en 2x1 cobran exactamente 3 unidades');
  assert(calc2x1.unidadesBonificadas === 2, 'CRITERIO CW-12: 5 unidades en 2x1 bonifican 2 unidades');
  assert(calc2x1.ahorro.equals(200), 'CRITERIO CW-12: Ahorro de 5 unidades de $100 en 2x1 es $200.00 (cuestan $300.00)');

  // Caso 2: 4 unidades de 100 en 3x1 -> Cobran 2 (200), Ahorro 2 (200), Entregadas 4
  const calc3x1 = PromocionesService.calcularAhorroDePromocion(
    { tipo: 'NXM', porcentaje: null, n: 3, m: 1 },
    new Decimal('100.00'),
    4
  );
  assert(calc3x1.unidadesCobradas === 2, 'CRITERIO CW-12: 4 unidades en 3x1 cobran exactamente 2 unidades');
  assert(calc3x1.unidadesBonificadas === 2, 'CRITERIO CW-12: 4 unidades en 3x1 bonifican 2 unidades');
  assert(calc3x1.ahorro.equals(200), 'CRITERIO CW-12: Ahorro de 4 unidades de $100 en 3x1 es $200.00 (cuestan $200.00)');

  // Caso 3: 7 unidades de 50 en 3x2 -> 2 grupos de 3 + 1 sobrante -> Cobran 2*2 + 1 = 5, Bonifican 2
  const calc3x2 = PromocionesService.calcularAhorroDePromocion(
    { tipo: 'NXM', porcentaje: null, n: 3, m: 2 },
    new Decimal('50.00'),
    7
  );
  assert(calc3x2.unidadesCobradas === 5, '7 unidades en 3x2 cobran 5 unidades');
  assert(calc3x2.unidadesBonificadas === 2, '7 unidades en 3x2 bonifican 2 unidades');
  assert(calc3x2.ahorro.equals(100), 'Ahorro de 7 unidades de $50 en 3x2 es $100.00');

  // Caso 4: Cantidad insuficiente para formar un grupo NxM (1 unidad en 2x1)
  const calcInsuficiente = PromocionesService.calcularAhorroDePromocion(
    { tipo: 'NXM', porcentaje: null, n: 2, m: 1 },
    new Decimal('100.00'),
    1
  );
  assert(calcInsuficiente.unidadesCobradas === 1, '1 unidad en 2x1 se cobra completa');
  assert(calcInsuficiente.unidadesBonificadas === 0, '1 unidad en 2x1 no bonifica');
  assert(calcInsuficiente.ahorro.equals(0), 'Ahorro es $0.00 cuando no se completa un grupo NxM');

  // 3. Regla de Selección Única por Orden (CW-13)
  console.log('\n🏆 3. Selección de la Mejor Promoción Única por Orden (CW-13):');

  // Configurar promociones en almacén:
  // Promo 1: 15% en Platillo 1 (Hamburguesa)
  const promo1 = await PromocionesService.crearPromocion(
    {
      nombre: 'Hamburguesa 15%',
      platilloId: 1,
      tipo: 'PORCENTAJE',
      porcentaje: 15,
      duracion: 'PERMANENTE'
    },
    1
  );

  // Promo 2: 2x1 en Platillo 2 (Papas Fritas)
  const promo2 = await PromocionesService.crearPromocion(
    {
      nombre: 'Papas 2x1',
      platilloId: 2,
      tipo: 'NXM',
      n: 2,
      m: 1,
      duracion: 'PERMANENTE'
    },
    1
  );

  // Orden con:
  // - 2 Hamburguesas ($100 c/u -> Subtotal $200). Con promo1 daría ahorro de $30.00.
  // - 4 Papas Fritas ($50 c/u -> Subtotal $200). Con promo2 daría ahorro de $100.00 (bonifica 2 papas).
  // Solo se debe aplicar Promo 2 porque otorga mayor ahorro ($100 > $30).
  const cotizacion = await PromocionesService.cotizarOrden([
    { platilloId: 1, cantidad: 2 },
    { platilloId: 2, cantidad: 4 }
  ]);

  assert(cotizacion.promocionAplicada !== null, 'Se aplicó una promoción a la orden');
  assert(cotizacion.promocionAplicada?.id === promo2.id, 'CRITERIO CW-13: Gana la promoción con MAYOR ahorro efectivo (Papas 2x1)');
  assert(cotizacion.descuentoTotal === '100.00', 'Descuento total de la orden es $100.00');
  assert(cotizacion.subtotalBruto === '400.00', 'Subtotal bruto total es $400.00 (2x100 + 4x50)');
  assert(cotizacion.total === '300.00', 'Total neto orden es $300.00 (400 - 100)');

  // Verificar partidas individuales:
  const partidaHamburguesa = cotizacion.partidas.find((p) => p.platilloId === 1)!;
  const partidaPapas = cotizacion.partidas.find((p) => p.platilloId === 2)!;

  assert(partidaHamburguesa.descuento === '0.00', 'Platillo no beneficiado no recibe descuento');
  assert(partidaHamburguesa.subtotalNeto === '200.00', 'Platillo no beneficiado conserva precio íntegro');
  assert(partidaHamburguesa.promocionAplicadaId === null, 'Platillo no beneficiado tiene promocionAplicadaId null');

  assert(partidaPapas.descuento === '100.00', 'Platillo beneficiado refleja el descuento íntegro');
  assert(partidaPapas.subtotalNeto === '100.00', 'Subtotal neto de partida beneficiada es $100.00');
  assert(partidaPapas.unidadesCobradas === 2, 'Papas cobra 2 unidades');
  assert(partidaPapas.unidadesBonificadas === 2, 'Papas bonifica 2 unidades');
  assert(partidaPapas.cantidad === 4, 'Cantidad física entregada permanece en 4 (no se altera)');

  // Suma de partidas == total
  const sumaNetos = new Decimal(partidaHamburguesa.subtotalNeto).plus(partidaPapas.subtotalNeto);
  assert(sumaNetos.equals(new Decimal(cotizacion.total)), 'CRITERIO CW-13: La suma de partidas netas es exactamente igual al total de la orden');

  // 4. Desempate Determinista por Menor ID (CW-13)
  console.log('\n⚖️ 4. Desempate Determinista por Menor ID (CW-13):');

  // Limpiar promociones y crear dos promociones que generen idéntico ahorro:
  almacenMemoria.promociones = [];
  // Promo A (ID 1): 2x1 en Hamburguesa (2 unidades ahorran $100.00)
  const promoA = await PromocionesService.crearPromocion(
    {
      nombre: 'Promo A Hamburguesa 2x1 (ID Menor)',
      platilloId: 1,
      tipo: 'NXM',
      n: 2,
      m: 1,
      duracion: 'PERMANENTE'
    },
    1
  );

  // Promo B (ID 2): 2x1 en Papas con 4 unidades (ahorran $100.00)
  const promoB = await PromocionesService.crearPromocion(
    {
      nombre: 'Promo B Papas 2x1 (ID Mayor)',
      platilloId: 2,
      tipo: 'NXM',
      n: 2,
      m: 1,
      duracion: 'PERMANENTE'
    },
    1
  );

  // Orden: 2 Hamburguesas ($100 ahorro) y 4 Papas ($100 ahorro). Ambas dan exactamente $100.00.
  const cotizacionEmpate = await PromocionesService.cotizarOrden([
    { platilloId: 1, cantidad: 2 },
    { platilloId: 2, cantidad: 4 }
  ]);

  assert(cotizacionEmpate.promocionAplicada?.id === promoA.id, `CRITERIO CW-13: Ante empate en ahorro ($100.00), desempata por MENOR ID (eligió ID ${promoA.id} sobre ID ${promoB.id})`);

  // 5. Total Cero Válido sin Evitar Consumos (CW-11)
  console.log('\n🆓 5. Total Cero Válido (CW-11):');
  almacenMemoria.promociones = [];
  const promoGratis = await PromocionesService.crearPromocion(
    {
      nombre: 'Promo 100% Cortesía',
      platilloId: 1,
      tipo: 'PORCENTAJE',
      porcentaje: 100,
      duracion: 'PERMANENTE'
    },
    1
  );

  const cotizacionCero = await PromocionesService.cotizarOrden([{ platilloId: 1, cantidad: 2 }]);
  assert(cotizacionCero.subtotalBruto === '200.00', 'Subtotal bruto $200.00');
  assert(cotizacionCero.descuentoTotal === '200.00', 'Descuento total $200.00');
  assert(cotizacionCero.total === '0.00', 'CRITERIO CW-11: Total es 0.00 válido');
  assert(cotizacionCero.partidas[0].cantidad === 2, 'Unidades físicas entregadas son 2 (para consumo de inventario)');

  console.log('\n===============================================================');
  console.log(`🏁 RESULTADO DE PRUEBAS W3-03: ${testsPassed}/${testsPassed + testsFailed} EXITOSAS`);
  console.log('===============================================================');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Error no controlado en pruebas:', err);
  process.exit(1);
});
