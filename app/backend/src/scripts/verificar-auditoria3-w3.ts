/**
 * verificar-auditoria3-w3.ts
 * Batería de verificación en PostgreSQL aislado para Auditoría 3 — Integrante 3 (Descuentos y Promociones).
 * Cubre los hallazgos:
 * - A3-3-01: Fechas relativas a la ejecución y reloj controlado reproducible en cualquier fecha.
 * - A3-3-02: Afirmación del motivo al modificar fechaInicio (conserva promoción vigente con nueva fechaInicio)
 *            y escenario real de vencimiento por paso del tiempo durante espera de bloqueos FOR UPDATE en PostgreSQL.
 * - A3-3-03: Batería transaccional real con TEST_DATABASE_URL (base local asmibuy_test_*) sin imprimir credenciales.
 * - A3-3-04: Reloj unificado clock_timestamp() en PostgreSQL para cotización y confirmación + contrato NTP.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const HORA_MS = 3_600_000;

async function run() {
  if (process.env.DATABASE_URL) {
    throw new Error('Retire DATABASE_URL operativa antes de ejecutar pruebas.');
  }
  const conexion = process.env.TEST_DATABASE_URL;
  if (!conexion) {
    throw new Error('TEST_DATABASE_URL es obligatoria: use una base local desechable asmibuy_test_*.');
  }
  const destino = new URL(conexion);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(destino.hostname) ||
    !/^\/asmibuy_test_[a-z0-9_]+$/.test(destino.pathname) ||
    !['postgres:', 'postgresql:'].includes(destino.protocol)
  ) {
    throw new Error('Solo se permiten bases locales dedicadas asmibuy_test_*.');
  }

  // Configurar variables de entorno antes de importar el pool y los servicios
  process.env.DATABASE_URL = conexion;
  process.env.DB_SSL = 'false';
  process.env.BUSINESS_TIME_ZONE = 'America/Mexico_City';

  const { pool } = await import('../config/database');
  const { PromocionesService, ErrorPromocion } = await import('../services/promociones.service');
  const { VentasService } = await import('../services/ventas.service');
  const { CatalogoService } = await import('../services/catalogo.service');
  const { InventarioService } = await import('../services/inventario.service');

  let comprobaciones = 0;
  const comprobar = (valor: unknown, descripcion: string) => {
    assert.ok(valor, descripcion);
    console.log(`  ✅ [PASS ${++comprobaciones}] ${descripcion}`);
  };

  console.log('\n========================================================================');
  console.log('🧪 SUITE POSTGRESQL AUDITORÍA 3 — INTEGRANTE 3 (Descuentos y Promociones)');
  console.log('========================================================================\n');

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // 0. MIGRADOR REAL Y ENTORNO AISLADO POSTGRESQL
    // ─────────────────────────────────────────────────────────────────────────
    execFileSync(process.execPath, [path.resolve(__dirname, '../migrations/migrador.js')], {
      env: process.env,
      stdio: 'pipe'
    });

    const numMigraciones = (await pool.query('SELECT count(*)::int AS n FROM schema_migraciones')).rows[0].n as number;
    comprobar(numMigraciones >= 7, `Migrador real ejecutado: ${numMigraciones} migraciones aplicadas en schema_migraciones`);

    const pgVersion = (await pool.query('SHOW server_version')).rows[0].server_version as string;
    const pgTz = (await pool.query('SHOW TimeZone')).rows[0].TimeZone as string;
    console.log(`  ℹ️ PostgreSQL ${pgVersion} | TimeZone=${pgTz} | Entorno local aislado (credenciales omitidas)\n`);
    comprobar(pgTz === 'UTC', 'Sesión PostgreSQL configurada en TimeZone=UTC (coordinado con A3-1-02)');

    // Preparación de datos base de prueba (sin TRUNCATE ni DROP)
    const sufijo = randomUUID().slice(0, 8);
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('Solo-Pruebas-W3-A3!', 4);
    const usuariosRes = await pool.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, perfil)
       VALUES ('Admin W3 A3', $1, $3, 'ADMINISTRADOR'), ('Caja W3 A3', $2, $3, 'TRABAJADOR')
       RETURNING id`,
      [`adminw3-${sufijo}@pruebas.invalid`, `cajaw3-${sufijo}@pruebas.invalid`, hash]
    );
    const [adminId, cajaId] = usuariosRes.rows.map((r: any) => Number(r.id));

    const insumoBase = await CatalogoService.crearIngrediente({
      nombre: `Insumo W3 ${sufijo}`,
      unidad: 'pieza',
      minimo: '5'
    });
    await InventarioService.registrarEntrada({
      ingredienteId: insumoBase.id,
      cantidad: '500',
      motivo: 'Stock inicial pruebas A3-W3',
      usuarioId: adminId
    });

    const platilloA = await CatalogoService.crearPlatillo({
      nombre: `Hamburguesa W3-A ${sufijo}`,
      precio: '120.00',
      receta: [{ ingredienteId: insumoBase.id, cantidad: '1' }]
    });
    const platilloB = await CatalogoService.crearPlatillo({
      nombre: `Papas W3-B ${sufijo}`,
      precio: '60.00',
      receta: [{ ingredienteId: insumoBase.id, cantidad: '1' }]
    });

    const contarOrdenes = async (): Promise<number> =>
      (await pool.query('SELECT count(*)::int AS n FROM ordenes')).rows[0].n as number;

    // ─────────────────────────────────────────────────────────────────────────
    // 1. A3-3-01 Y A3-3-02: CAMBIO DE VIGENCIA EN POSTGRESQL (CONSERVANDO PROMOCIÓN)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('📅 1. Cambio de vigencia en PostgreSQL con fechas relativas y motivo verificado (A3-3-01 / A3-3-02)');

    const ahoraDbRes = await pool.query('SELECT clock_timestamp() AS ahora');
    const baseMs = new Date(ahoraDbRes.rows[0].ahora).getTime();

    const tInicioOrig = new Date(baseMs - 2 * HORA_MS);
    const tFinOrig = new Date(baseMs + 3 * HORA_MS);

    const promoVigencia = await PromocionesService.crearPromocion(
      {
        nombre: `Promo Vigencia PG ${sufijo}`,
        platilloId: platilloA.id,
        tipo: 'PORCENTAJE',
        porcentaje: '20.00',
        duracion: 'TEMPORAL',
        fechaInicio: tInicioOrig.toISOString(),
        fechaFin: tFinOrig.toISOString()
      },
      adminId
    );

    const itemsVigencia = [{ platilloId: platilloA.id, cantidad: 2 }]; // 2 x 120 = 240, desc 20% = 48, total = 192
    const cotizacionInicial = await PromocionesService.cotizarOrden(itemsVigencia);
    comprobar(
      cotizacionInicial.total === '192.00' &&
        cotizacionInicial.descuentoTotal === '48.00' &&
        cotizacionInicial.promocionAplicada?.id === promoVigencia.id &&
        cotizacionInicial.promocionAplicada?.fechaInicio === tInicioOrig.toISOString() &&
        cotizacionInicial.promocionAplicada?.fechaFin === tFinOrig.toISOString(),
      'Cotización inicial en PostgreSQL incluye snapshot con fechaInicio y fechaFin exactas'
    );

    // 1.1 Adelantar fechaInicio 1 h en PostgreSQL (la promoción sigue vigente y da el mismo ahorro/total)
    const tInicioAdelantado = new Date(baseMs - 3 * HORA_MS);
    await PromocionesService.actualizarPromocion(
      promoVigencia.id,
      { fechaInicio: tInicioAdelantado.toISOString() },
      adminId
    );

    const ordenesAntesInicio = await contarOrdenes();
    let errorInicioCapturado: any = null;
    try {
      await VentasService.confirmarVenta(
        {
          claveIdempotencia: `a3w3-ini-${sufijo}`,
          metodoPago: 'EFECTIVO',
          items: itemsVigencia,
          cotizacionAceptada: cotizacionInicial
        },
        cajaId
      );
    } catch (err: any) {
      errorInicioCapturado = err;
    }

    const nuevaCotTrasInicio = errorInicioCapturado?.detalles?.nuevaCotizacion;
    comprobar(
      errorInicioCapturado instanceof ErrorPromocion &&
        errorInicioCapturado.codigo === 'COTIZACION_DESACTUALIZADA' &&
        errorInicioCapturado.statusCode === 409 &&
        (await contarOrdenes()) === ordenesAntesInicio,
      'Adelantar fechaInicio 1 h al confirmar en PostgreSQL rechaza con COTIZACION_DESACTUALIZADA (409) sin crear orden'
    );
    comprobar(
      nuevaCotTrasInicio?.promocionAplicada?.id === promoVigencia.id &&
        nuevaCotTrasInicio?.promocionAplicada?.fechaInicio === tInicioAdelantado.toISOString() &&
        nuevaCotTrasInicio?.total === '192.00' &&
        nuevaCotTrasInicio?.descuentoTotal === '48.00',
      'A3-3-02: La nueva cotización conserva la promoción vigente con el mismo ahorro y refleja la nueva fechaInicio'
    );

    // 1.2 Extender fechaFin 2 h adicionales en PostgreSQL sobre la cotización recién actualizada
    const tFinExtendido = new Date(baseMs + 5 * HORA_MS);
    await PromocionesService.actualizarPromocion(
      promoVigencia.id,
      { fechaFin: tFinExtendido.toISOString() },
      adminId
    );

    let errorFinCapturado: any = null;
    try {
      await VentasService.confirmarVenta(
        {
          claveIdempotencia: `a3w3-fin-${sufijo}`,
          metodoPago: 'EFECTIVO',
          items: itemsVigencia,
          cotizacionAceptada: nuevaCotTrasInicio
        },
        cajaId
      );
    } catch (err: any) {
      errorFinCapturado = err;
    }

    const nuevaCotTrasFin = errorFinCapturado?.detalles?.nuevaCotizacion;
    comprobar(
      errorFinCapturado instanceof ErrorPromocion &&
        errorFinCapturado.codigo === 'COTIZACION_DESACTUALIZADA' &&
        errorFinCapturado.statusCode === 409 &&
        nuevaCotTrasFin?.promocionAplicada?.id === promoVigencia.id &&
        nuevaCotTrasFin?.promocionAplicada?.fechaFin === tFinExtendido.toISOString() &&
        nuevaCotTrasFin?.total === '192.00',
      'Extender fechaFin al confirmar en PostgreSQL rechaza con 409 conservando la promoción con la nueva fechaFin'
    );

    // 1.3 Confirmar venta con la cotización vigente sin cambios adicionales
    const ordenConfirmadaVigencia = await VentasService.confirmarVenta(
      {
        claveIdempotencia: `a3w3-ok-${sufijo}`,
        metodoPago: 'EFECTIVO',
        items: itemsVigencia,
        cotizacionAceptada: nuevaCotTrasFin
      },
      cajaId
    );
    comprobar(
      ordenConfirmadaVigencia.estado === 'CONFIRMADA' &&
        ordenConfirmadaVigencia.total === '192.00' &&
        ordenConfirmadaVigencia.descuentoTotal === '48.00' &&
        ordenConfirmadaVigencia.promocion?.id === promoVigencia.id,
      'Confirmación en PostgreSQL aprueba cuando fechaInicio, fechaFin y parámetros permanecen idénticos'
    );

    // 1.4 Reproducibilidad en otro día futuro (+20 días) con reloj controlado en PostgreSQL
    const otroDiaMs = baseMs + 20 * 24 * HORA_MS;
    const promoOtroDia = await PromocionesService.crearPromocion(
      {
        nombre: `Promo Futuro PG ${sufijo}`,
        platilloId: platilloA.id,
        tipo: 'PORCENTAJE',
        porcentaje: '30.00',
        duracion: 'TEMPORAL',
        fechaInicio: new Date(otroDiaMs - HORA_MS).toISOString(),
        fechaFin: new Date(otroDiaMs + 3 * HORA_MS).toISOString()
      },
      adminId
    );
    const cotOtroDia = await PromocionesService.cotizarOrden(
      [{ platilloId: platilloA.id, cantidad: 1 }],
      new Date(otroDiaMs)
    );
    const revalOtroDia = await PromocionesService.validarConsistenciaCotizacion(
      cotOtroDia,
      pool,
      false,
      new Date(otroDiaMs + 10 * 60_000)
    );
    comprobar(
      revalOtroDia.promocionAplicada?.id === promoOtroDia.id && revalOtroDia.total === '84.00',
      'A3-3-01: Revalidación reproducible en otro día futuro (+20 días) mediante reloj controlado'
    );

    // Retirar promociones de la sección 1 para aislar las siguientes pruebas
    await PromocionesService.retirarPromocion(promoVigencia.id, adminId);
    await PromocionesService.retirarPromocion(promoOtroDia.id, adminId);

    // ─────────────────────────────────────────────────────────────────────────
    // 2. A3-3-02 / A2-3-02: VENCIMIENTO DURANTE LA ESPERA DE BLOQUEOS EN POSTGRESQL
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n⏱️ 2. Vencimiento real por paso del tiempo durante espera de bloqueo FOR UPDATE en PostgreSQL (A3-3-02)');

    const ahoraEsperaRes = await pool.query('SELECT clock_timestamp() AS ahora');
    const ahoraEsperaMs = new Date(ahoraEsperaRes.rows[0].ahora).getTime();
    const fechaFinCorta = new Date(ahoraEsperaMs + 1500); // Vence a los 1.5 s

    const promo100 = await PromocionesService.crearPromocion(
      {
        nombre: `Promo 100% Espera ${sufijo}`,
        platilloId: platilloA.id,
        tipo: 'PORCENTAJE',
        porcentaje: '100.00',
        duracion: 'TEMPORAL',
        fechaInicio: new Date(ahoraEsperaMs - 60_000).toISOString(),
        fechaFin: fechaFinCorta.toISOString()
      },
      adminId
    );

    // Cotizar mientras la promoción del 100% está vigente (total = 0.00)
    const cotizacionGratis = await PromocionesService.cotizarOrden([{ platilloId: platilloA.id, cantidad: 1 }]);
    comprobar(
      cotizacionGratis.total === '0.00' &&
        cotizacionGratis.descuentoTotal === '120.00' &&
        cotizacionGratis.promocionAplicada?.id === promo100.id,
      'Cotización inicial con promoción del 100% vigente produce total 0.00'
    );

    const ordenesAntesEspera = await contarOrdenes();
    const clienteRetenedor = await pool.connect();
    try {
      await clienteRetenedor.query('BEGIN');
      // Retener el platillo FOR UPDATE en otra sesión de PostgreSQL
      await clienteRetenedor.query('SELECT id FROM platillos WHERE id = $1 FOR UPDATE', [platilloA.id]);

      // Lanzar la confirmación en paralelo; quedará esperando el bloqueo FOR UPDATE sobre platilloA
      const promesaConfirmacion = VentasService.confirmarVenta(
        {
          claveIdempotencia: `a3w3-espera-${sufijo}`,
          metodoPago: 'SIN_COBRO',
          items: [{ platilloId: platilloA.id, cantidad: 1 }],
          cotizacionAceptada: cotizacionGratis
        },
        cajaId
      ).then(
        (res) => ({ estado: 'exito' as const, res }),
        (err) => ({ estado: 'rechazo' as const, err })
      );

      // Retener el bloqueo 2.3 s para que la promoción venza mientras la confirmación espera el lock
      await new Promise((resolve) => setTimeout(resolve, 2300));
      await clienteRetenedor.query('COMMIT');

      const resultadoEspera = await promesaConfirmacion;
      const errEspera = resultadoEspera.estado === 'rechazo' ? resultadoEspera.err : null;
      const nuevaCotEspera = errEspera?.detalles?.nuevaCotizacion;

      comprobar(
        resultadoEspera.estado === 'rechazo' &&
          errEspera instanceof ErrorPromocion &&
          errEspera.codigo === 'COTIZACION_DESACTUALIZADA' &&
          errEspera.statusCode === 409,
        'Al liberar el bloqueo tras 2.3 s, la confirmación recibe COTIZACION_DESACTUALIZADA (409) por evaluación clock_timestamp() post-bloqueos'
      );
      comprobar(
        nuevaCotEspera?.promocionAplicada === null &&
          nuevaCotEspera?.total === '120.00' &&
          nuevaCotEspera?.descuentoTotal === '0.00',
        'La nueva cotización tras expirar durante la espera descarta la promoción del 100% y calcula total íntegro (120.00)'
      );
      comprobar(
        (await contarOrdenes()) === ordenesAntesEspera,
        'No se creó ninguna orden a $0.00 cuando la promoción venció durante la espera de bloqueos'
      );
    } finally {
      clienteRetenedor.release();
    }

    await PromocionesService.retirarPromocion(promo100.id, adminId);

    // ─────────────────────────────────────────────────────────────────────────
    // 3. A3-3-03 / A2-3-03: CONCURRENCIA EN POSTGRESQL SIN INTERBLOQUEO 40P01
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n🔒 3. Concurrencia real en PostgreSQL: ventas cruzadas y edición concurrente sin 40P01 (A3-3-03)');

    // Crear dos promociones permanentes con el mismo ahorro ($30.00) para probar CW-13 bajo concurrencia
    const promoEmpate1 = await PromocionesService.crearPromocion(
      {
        nombre: `Promo Empate 1 ${sufijo}`,
        platilloId: platilloA.id, // $120 * 25% = $30.00
        tipo: 'PORCENTAJE',
        porcentaje: '25.00',
        duracion: 'PERMANENTE'
      },
      adminId
    );
    const promoEmpate2 = await PromocionesService.crearPromocion(
      {
        nombre: `Promo Empate 2 ${sufijo}`,
        platilloId: platilloB.id, // $60 * 50% = $30.00
        tipo: 'PORCENTAJE',
        porcentaje: '50.00',
        duracion: 'PERMANENTE'
      },
      adminId
    );

    const cotOrdenDirecto = await PromocionesService.cotizarOrden([
      { platilloId: platilloA.id, cantidad: 1 },
      { platilloId: platilloB.id, cantidad: 1 }
    ]);
    const cotOrdenInverso = await PromocionesService.cotizarOrden([
      { platilloId: platilloB.id, cantidad: 1 },
      { platilloId: platilloA.id, cantidad: 1 }
    ]);

    // 6 ventas concurrentes con orden de platillos invertido entre solicitudes
    const tareasConcurrentes = Array.from({ length: 6 }, (_, idx) => {
      const inverso = idx % 2 === 1;
      const items = inverso
        ? [
            { platilloId: platilloB.id, cantidad: 1 },
            { platilloId: platilloA.id, cantidad: 1 }
          ]
        : [
            { platilloId: platilloA.id, cantidad: 1 },
            { platilloId: platilloB.id, cantidad: 1 }
          ];
      return VentasService.confirmarVenta(
        {
          claveIdempotencia: `a3w3-conc-${sufijo}-${idx}`,
          metodoPago: 'EFECTIVO',
          items,
          cotizacionAceptada: inverso ? cotOrdenInverso : cotOrdenDirecto
        },
        cajaId
      );
    });

    const ordenesConcurrentes = await Promise.all(tareasConcurrentes);
    const menorPromoId = Math.min(promoEmpate1.id, promoEmpate2.id);
    comprobar(
      ordenesConcurrentes.length === 6 &&
        ordenesConcurrentes.every(
          (o) => o.estado === 'CONFIRMADA' && o.total === '150.00' && o.promocion?.id === menorPromoId
        ),
      `6 ventas concurrentes con platillos en orden inverso completadas sin deadlock 40P01 y desempate CW-13 (ID ${menorPromoId})`
    );

    // Venta frente a edición concurrente de promoción bajo bloqueo en PostgreSQL
    const cotAntesEdicionPromo = await PromocionesService.cotizarOrden([{ platilloId: platilloA.id, cantidad: 1 }]);
    const clienteBloqueoEdicion = await pool.connect();
    try {
      await clienteBloqueoEdicion.query('BEGIN');
      await clienteBloqueoEdicion.query('SELECT id FROM platillos WHERE id = $1 FOR UPDATE', [platilloA.id]);

      // Mientras el platillo está bloqueado, se actualiza el porcentaje de promoEmpate1 de 25% a 10%
      const promesaEdicion = PromocionesService.actualizarPromocion(
        promoEmpate1.id,
        { porcentaje: '10.00' },
        adminId
      );
      const promesaVenta = VentasService.confirmarVenta(
        {
          claveIdempotencia: `a3w3-editpromo-${sufijo}`,
          metodoPago: 'EFECTIVO',
          items: [{ platilloId: platilloA.id, cantidad: 1 }],
          cotizacionAceptada: cotAntesEdicionPromo
        },
        cajaId
      ).then(
        (res) => ({ estado: 'exito' as const, res }),
        (err) => ({ estado: 'rechazo' as const, err })
      );

      await new Promise((resolve) => setTimeout(resolve, 250));
      await clienteBloqueoEdicion.query('COMMIT');

      await promesaEdicion;
      const resVentaConcurrente = await promesaVenta;
      comprobar(
        resVentaConcurrente.estado === 'rechazo' &&
          resVentaConcurrente.err instanceof ErrorPromocion &&
          resVentaConcurrente.err.codigo === 'COTIZACION_DESACTUALIZADA' &&
          resVentaConcurrente.err.detalles?.nuevaCotizacion?.total === '108.00',
        'Venta concurrente frente a edición de promoción serializa sin 40P01 y rechaza con nuevo resumen ($108.00)'
      );
    } finally {
      clienteBloqueoEdicion.release();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. A3-3-04 Y A3-1-02: RELOJ UNIFICADO Y CONTRATO DOCUMENTADO
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n📜 4. Reloj unificado clock_timestamp() en PostgreSQL, marcas TIMESTAMPTZ y contrato (A3-3-04)');

    const tAntes = Date.now();
    const cotSinBloqueo = await PromocionesService.cotizarOrden([{ platilloId: platilloA.id, cantidad: 1 }]);
    const tEvalMs = new Date(cotSinBloqueo.fechaEvaluacion).getTime();
    comprobar(
      !Number.isNaN(tEvalMs) && Math.abs(tEvalMs - tAntes) < 10_000,
      'cotizarOrden sin bloqueo en modo PostgreSQL obtiene fechaEvaluacion desde clock_timestamp() del servidor'
    );

    // Verificar que insertar en promociones con DEFAULT CURRENT_TIMESTAMP bajo otra zona horaria no desplaza 6 h
    const clienteZona = await pool.connect();
    try {
      await clienteZona.query("SET TIME ZONE 'America/Mexico_City'");
      const resDefault = await clienteZona.query(
        `INSERT INTO promociones (nombre, platillo_id, tipo, porcentaje, duracion, estado, usuario_id)
         VALUES ($1, $2, 'PORCENTAJE', 15.00, 'PERMANENTE', 'INACTIVA', $3)
         RETURNING EXTRACT(EPOCH FROM (clock_timestamp() - creado_en)) AS diff_seg`,
        [`Promo Default TZ ${sufijo}`, platilloA.id, adminId]
      );
      const diffSeg = Math.abs(Number(resDefault.rows[0].diff_seg));
      comprobar(
        diffSeg < 5,
        `Tabla promociones conserva instante UTC exacto con sesión en America/Mexico_City (desfase: ${diffSeg.toFixed(3)} s < 5 s)`
      );
    } finally {
      await clienteZona.query("SET TIME ZONE 'UTC'").catch(() => {});
      clienteZona.release();
    }

    const rutaContrato = path.resolve(process.cwd(), 'docs/contratos/03-promociones.md');
    const textoContrato = fs.readFileSync(rutaContrato, 'utf-8');
    comprobar(
      textoContrato.includes('Adenda de integración — Auditoría 3') &&
        textoContrato.includes('NTP') &&
        textoContrato.includes('clock_timestamp()'),
      'Contrato 03-promociones.md documenta hora de referencia de la base (clock_timestamp()) y sincronización NTP (A3-3-04)'
    );

    comprobar(
      pool.idleCount === pool.totalCount && pool.waitingCount === 0,
      'Pool de conexiones PostgreSQL sin clientes retenidos al finalizar la batería'
    );

    console.log('\n========================================================================');
    console.log(`🏁 RESULTADO AUDITORÍA 3 (INTEGRANTE 3 - POSTGRESQL): ${comprobaciones}/${comprobaciones} exitosas, 0 fallos`);
    console.log('========================================================================\n');
  } finally {
    await pool.end();
  }
}

run().catch((e: any) => {
  // No imprimir objetos pg, URLs ni credenciales de conexión
  console.error(
    `FAIL auditoría 3 (W3): ${e?.code || e?.codigo || e?.name || 'ERROR'}; ${
      e instanceof assert.AssertionError ? e.message : e?.message || 'revise el escenario en entorno aislado'
    }`
  );
  process.exitCode = 1;
});
