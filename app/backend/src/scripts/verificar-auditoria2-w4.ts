/** Regresión A2-4. Solo PostgreSQL local desechable, nunca DATABASE_URL operativa. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

async function run() {
  if (process.env.DATABASE_URL) throw new Error('Retire DATABASE_URL operativa antes de ejecutar pruebas.');
  const conexion = process.env.TEST_DATABASE_URL;
  if (!conexion) throw new Error('TEST_DATABASE_URL es obligatoria: use una base local desechable asmibuy_test_*.');
  const destino = new URL(conexion);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(destino.hostname) ||
      !/^\/asmibuy_test_[a-z0-9_]+$/.test(destino.pathname) ||
      !['postgres:', 'postgresql:'].includes(destino.protocol)) {
    throw new Error('Solo se permiten bases locales dedicadas asmibuy_test_*.');
  }
  process.env.DATABASE_URL = conexion;
  process.env.DB_SSL = 'false';
  process.env.BUSINESS_TIME_ZONE = 'America/Mexico_City';
  // Configurar ANTES de importar los servicios/pool (dotenv no sobrescribe el entorno).
  const { pool } = await import('../config/database');
  const { VentasService } = await import('../services/ventas.service');
  const { PromocionesService } = await import('../services/promociones.service');
  const { CatalogoService } = await import('../services/catalogo.service');
  const { InventarioService } = await import('../services/inventario.service');
  const { normalizarPeriodo } = await import('../services/periodo-ventas');
  let comprobaciones = 0;
  const comprobar = (valor: unknown, descripcion: string) => {
    assert.ok(valor, descripcion);
    console.log(`PASS ${++comprobaciones}: ${descripcion}`);
  };
  try {
    execFileSync(process.execPath, [path.resolve(__dirname, '../migrations/migrador.js')], {
      env: process.env, stdio: 'pipe'
    });
    comprobar((await pool.query('SELECT count(*)::int AS n FROM schema_migraciones')).rows[0].n === 6,
      'Migrador real: seis migraciones aplicadas');
    console.log(`PostgreSQL ${(await pool.query('SHOW server_version')).rows[0].server_version}; entorno aislado (conexión omitida)`);
    const sufijo = randomUUID().slice(0, 8);
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('Solo-Pruebas-W4-2026!', 4);
    const usuarios = await pool.query(`INSERT INTO usuarios (nombre, correo, password_hash, perfil)
      VALUES ('Caja A A2', $1, $3, 'ADMINISTRADOR'), ('Caja B A2', $2, $3, 'TRABAJADOR') RETURNING id`,
      [`cajaa-${sufijo}@pruebas.invalid`, `cajab-${sufijo}@pruebas.invalid`, hash]);
    const [usuarioA, usuarioB] = usuarios.rows.map(r => r.id as number);
    const ingrediente = await CatalogoService.crearIngrediente({ nombre: `Insumo A2 ${sufijo}`, unidad: 'pieza', minimo: '0' });
    await InventarioService.registrarEntrada({ ingredienteId: ingrediente.id, cantidad: '1000', motivo: 'Fixture A2', usuarioId: usuarioA });
    const platillo = await CatalogoService.crearPlatillo({ nombre: `Platillo A2 ${sufijo}`, precio: '10.00', receta: [{ ingredienteId: ingrediente.id, cantidad: '1' }] });
    const items = [{ platilloId: platillo.id, cantidad: 1 }];
    const cotizacion = await PromocionesService.cotizarOrden(items);
    const solicitud = (clave = randomUUID(), cot = cotizacion) => ({ claveIdempotencia: clave, metodoPago: 'EFECTIVO' as const, items, cotizacionAceptada: cot });
    const contar = async () => (await pool.query('SELECT count(*)::int AS n FROM ordenes')).rows[0].n as number;
    const saldo = async () => (await CatalogoService.obtenerIngredientePorId(ingrediente.id))!.existencia;

    const secuenciales = [];
    for (let i = 0; i < 14; i++) {
      const orden = await VentasService.confirmarVenta(solicitud(), usuarioA);
      secuenciales.push(orden);
      const persistida = await VentasService.buscarPorClaveIdempotencia(orden.claveIdempotencia);
      comprobar(persistida?.id === orden.id && persistida?.total === orden.total, `Venta secuencial ${i + 1}: respuesta coincide con persistencia`);
      comprobar(pool.idleCount === pool.totalCount && pool.waitingCount === 0, `Venta ${i + 1}: pool recupera todas las conexiones`);
    }

    let antes = await contar();
    const dos = await Promise.all([
      VentasService.confirmarVenta(solicitud(), usuarioA), VentasService.confirmarVenta(solicitud(), usuarioB)
    ]);
    comprobar(dos[0].id !== dos[1].id && await contar() === antes + 2, 'Dos cajas, mismo platillo, claves distintas: dos éxitos sin deadlock');
    const inputDuplicado = solicitud();
    antes = await contar();
    const duplicadas = await Promise.all(Array.from({ length: 12 }, () => VentasService.confirmarVenta(inputDuplicado, usuarioA)));
    comprobar(duplicadas.every(o => o.id === duplicadas[0].id) && await contar() === antes + 1, '12 envíos de la misma clave: una orden, sin agotar pool');
    await assert.rejects(VentasService.confirmarVenta(inputDuplicado, usuarioB), (e: any) => e.codigo === 'IDEMPOTENCIA_CONFLICTO');
    comprobar(true, 'Otro usuario no reutiliza la misma identidad');

    await CatalogoService.actualizarPlatillo(platillo.id, { receta: [{ ingredienteId: ingrediente.id, cantidad: '2' }] });
    antes = await contar();
    const saldoAntes = await saldo();
    await assert.rejects(VentasService.confirmarVenta(solicitud(), usuarioA), (e: any) => e.codigo === 'COTIZACION_DESACTUALIZADA');
    comprobar(await contar() === antes && await saldo() === saldoAntes, 'Cambiar receta 1 a 2 rechaza resumen anterior sin escrituras');
    const actualizada = await PromocionesService.cotizarOrden(items);
    const aceptada = await VentasService.confirmarVenta(solicitud(randomUUID(), actualizada), usuarioA);
    const consumo = await pool.query('SELECT cantidad FROM movimientos_inventario WHERE orden_id = $1', [aceptada.id]);
    comprobar(Number(consumo.rows[0].cantidad) === -2 && aceptada.partidas[0].recetaSnapshot?.[0].consumoTotal === '2', 'Nueva aceptación: snapshot y movimiento consumen exactamente 2');

    antes = await contar();
    const saldoRollback = await saldo();
    const original = InventarioService.descontarInventarioPorVenta;
    InventarioService.descontarInventarioPorVenta = async (...args) => {
      await original.apply(InventarioService, args);
      throw new Error('FALLO_INYECTADO_DESPUES_CONSUMO');
    };
    try {
      await assert.rejects(VentasService.confirmarVenta(solicitud(randomUUID(), actualizada), usuarioA), /FALLO_INYECTADO/);
    } finally {
      InventarioService.descontarInventarioPorVenta = original;
    }
    comprobar(await contar() === antes && await saldo() === saldoRollback, 'Fallo después de consumir revierte orden, detalle y movimientos');
    comprobar(pool.idleCount === pool.totalCount && pool.waitingCount === 0, 'Rollback también libera el cliente');

    const excesoItems = [{ platilloId: platillo.id, cantidad: 10000 }];
    const excesoCot = await PromocionesService.cotizarOrden(excesoItems);
    await assert.rejects(VentasService.confirmarVenta({ ...solicitud(), items: excesoItems, cotizacionAceptada: excesoCot }, usuarioA), (e: any) => e.codigo === 'STOCK_INSUFICIENTE');
    comprobar(await contar() === antes && await saldo() === saldoRollback, 'Stock insuficiente revierte toda la operación');

    const periodo = normalizarPeriodo({ fechaInicio: '2026-10-15', fechaFin: '2026-10-15' });
    comprobar(periodo.fechaInicioISO === '2026-10-15T06:00:00.000Z' && periodo.fechaFinISO === '2026-10-16T06:00:00.000Z', 'Día del negocio convertido a UTC con fin exclusivo');
    for (const fecha of ['2026-02-30', '2026-13-01', 'sin-fecha', '2026-10-15T24:01:00Z', '2026-10-15T00:00:00']) {
      assert.throws(() => normalizarPeriodo({ fechaInicio: fecha }));
      comprobar(true, `Rechaza fecha inválida: ${fecha}`);
    }
    assert.throws(() => normalizarPeriodo({ fechaInicio: '2026-10-16', fechaFin: '2026-10-15' }));
    comprobar(true, 'Rechaza rango invertido');
    process.env.BUSINESS_TIME_ZONE = 'America/New_York';
    const dst = normalizarPeriodo({ fechaInicio: '2026-03-08', fechaFin: '2026-03-08' });
    comprobar(Date.parse(dst.fechaFinISO!) - Date.parse(dst.fechaInicioISO!) === 23 * 3600000, 'Zona configurable: día con transición DST de 23 horas');
    process.env.BUSINESS_TIME_ZONE = 'America/Mexico_City';
    const instantes = ['2026-10-16 01:30:00+00', '2026-10-16 05:59:59.999999+00', '2026-10-16 06:00:00+00', '2026-10-15 05:59:59+00'];
    for (let i = 0; i < instantes.length; i++) await pool.query('UPDATE ordenes SET creado_en = $1 WHERE id = $2', [instantes[i], secuenciales[i].id]);
    const historial = await VentasService.listarHistorial({ fechaInicio: '2026-10-15', fechaFin: '2026-10-15' }, usuarioA, 'ADMINISTRADOR');
    const ids = new Set(historial.ordenes.map(o => o.id));
    comprobar(ids.has(secuenciales[0].id) && ids.has(secuenciales[1].id) && !ids.has(secuenciales[2].id) && !ids.has(secuenciales[3].id), 'PostgreSQL: 19:30 local y último microsegundo incluidos, límites externos excluidos');

    const secretoFalso = 'postgresql://usuario:SECRETO_FICTICIO@127.0.0.1/operativa';
    let salida = '';
    try {
      execFileSync(process.execPath, [path.resolve(__dirname, 'verificar-auditoria1-w4.js')], { env: { ...process.env, DATABASE_URL: secretoFalso }, stdio: 'pipe' });
    } catch (e: any) { salida = `${e.stdout}${e.stderr}`; }
    comprobar(salida.includes('solo admite memoria') && !salida.includes('SECRETO_FICTICIO'), 'Batería antigua rechaza configuración operativa sin imprimir secretos');
    console.log(`RESULTADO: ${comprobaciones}/${comprobaciones}. Fixtures conservados solo en base desechable para prueba de navegador.`);
  } finally {
    await pool.end();
  }
}

run().catch((e: any) => {
  // No imprimir objetos pg, URL ni stack con configuración de conexión.
  console.error(`FAIL auditoría 2: ${e.code || e.codigo || e.name || 'ERROR'}; ${e instanceof assert.AssertionError ? e.message : 'revise el escenario en entorno aislado'}`);
  process.exitCode = 1;
});
