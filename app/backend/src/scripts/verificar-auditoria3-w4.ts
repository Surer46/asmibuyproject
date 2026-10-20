/** Regresión A3-4. Solo PostgreSQL local desechable, nunca DATABASE_URL operativa. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';

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
  const { ventasRouter } = await import('../routes/ventas.routes');
  const express = (await import('express')).default;
  let comprobaciones = 0;
  const comprobar = (valor: unknown, descripcion: string) => {
    assert.ok(valor, descripcion);
    console.log(`PASS ${++comprobaciones}: ${descripcion}`);
  };
  const consultaOriginal = pool.query.bind(pool);
  const inyectarFallo = (fragmento: string) => {
    (pool as any).query = async (...args: any[]) => {
      if (String(args[0]).includes(fragmento)) {
        throw Object.assign(new Error('FALLO_INYECTADO_BD'), { code: '57P01' });
      }
      return (consultaOriginal as any)(...args);
    };
  };
  const restaurar = () => { (pool as any).query = consultaOriginal; };

  try {
    execFileSync(process.execPath, [path.resolve(__dirname, '../migrations/migrador.js')], {
      env: process.env, stdio: 'pipe'
    });
    // El total sigue a los archivos empaquetados (007 corrige defaults timestamptz, A3-1-02).
    const migracionesEsperadas = fs.readdirSync(path.resolve(__dirname, '../migrations')).filter(f => f.endsWith('.sql')).length;
    comprobar(migracionesEsperadas >= 7 &&
      (await pool.query('SELECT count(*)::int AS n FROM schema_migraciones')).rows[0].n === migracionesEsperadas,
      `Migrador real: ${migracionesEsperadas} migraciones aplicadas`);
    console.log(`PostgreSQL ${(await pool.query('SHOW server_version')).rows[0].server_version}; entorno aislado (conexión omitida)`);

    const sufijo = randomUUID().slice(0, 8);
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('Solo-Pruebas-W4-A3!', 4);
    const usuarios = await pool.query(`INSERT INTO usuarios (nombre, correo, password_hash, perfil)
      VALUES ('Admin A3', $1, $3, 'ADMINISTRADOR'), ('Caja A3', $2, $3, 'TRABAJADOR') RETURNING id`,
      [`admina3-${sufijo}@pruebas.invalid`, `cajaa3-${sufijo}@pruebas.invalid`, hash]);
    const [admin, caja] = usuarios.rows.map(r => r.id as number);
    const ingrediente = await CatalogoService.crearIngrediente({ nombre: `Insumo A3 ${sufijo}`, unidad: 'pieza', minimo: '0' });
    await InventarioService.registrarEntrada({ ingredienteId: ingrediente.id, cantidad: '500', motivo: 'Fixture A3', usuarioId: admin });
    const platilloA = await CatalogoService.crearPlatillo({ nombre: `Platillo A3-A ${sufijo}`, precio: '12.50', receta: [{ ingredienteId: ingrediente.id, cantidad: '1' }] });
    const platilloB = await CatalogoService.crearPlatillo({ nombre: `Platillo A3-B ${sufijo}`, precio: '7.25', receta: [{ ingredienteId: ingrediente.id, cantidad: '2' }] });
    const items = [{ platilloId: platilloA.id, cantidad: 2 }, { platilloId: platilloB.id, cantidad: 1 }];
    const cotizacion = await PromocionesService.cotizarOrden(items);
    const solicitud = (clave: string) => ({ claveIdempotencia: clave, metodoPago: 'EFECTIVO' as const, items, cotizacionAceptada: cotizacion });
    const contar = async () => (await pool.query('SELECT count(*)::int AS n FROM ordenes')).rows[0].n as number;

    // A3-4-02: claves fuera de formato se rechazan antes de consultar o escribir.
    for (const [clave, descripcion] of [['k'.repeat(101), '101 caracteres'], ['k'.repeat(150), '150 caracteres'], ['clave con espacios', 'espacios'], ['', 'vacía']] as const) {
      const antes = await contar();
      await assert.rejects(VentasService.confirmarVenta(solicitud(clave), caja), (e: any) => e.name === 'ErrorVenta' && e.codigo === 'DATOS_INVALIDOS' && e.statusCode === 400);
      comprobar(await contar() === antes, `Clave inválida (${descripcion}) → DATOS_INVALIDOS 400 sin escrituras`);
    }
    const claveLimite = `${sufijo}-${'k'.repeat(100)}`.slice(0, 100); // única por ejecución, 100 caracteres
    const ordenLimite = await VentasService.confirmarVenta(solicitud(claveLimite), caja);
    comprobar(ordenLimite.claveIdempotencia === claveLimite, 'Clave de exactamente 100 caracteres confirma una venta');
    const repetida = await VentasService.confirmarVenta(solicitud(` ${claveLimite} `), caja);
    comprobar(repetida.id === ordenLimite.id, 'La misma clave con espacios externos recupera la misma orden');

    const ordenes = [ordenLimite];
    for (let i = 0; i < 3; i++) ordenes.push(await VentasService.confirmarVenta(solicitud(randomUUID()), i === 0 ? admin : caja));

    // A3-4-04: historial con una consulta de partidas conserva el detalle de cada orden.
    const historial = await VentasService.listarHistorial({}, admin, 'ADMINISTRADOR');
    let coinciden = true;
    for (const orden of ordenes) {
      const enHistorial = historial.ordenes.find(o => o.id === orden.id);
      const individual = await VentasService.obtenerPorId(orden.id, admin, 'ADMINISTRADOR');
      coinciden = coinciden && !!enHistorial && JSON.stringify(enHistorial.partidas) === JSON.stringify(individual.partidas) && enHistorial.partidas.length === 2;
    }
    comprobar(coinciden, 'Historial agrupado: partidas por orden idénticas a la consulta individual');
    const propias = await VentasService.listarHistorial({}, caja, 'TRABAJADOR');
    comprobar(propias.ordenes.length > 0 && propias.ordenes.every(o => o.usuarioId === caja), 'Trabajador solo recibe sus ventas en el historial agrupado');

    // A3-4-01: fallos de PostgreSQL ya no se sustituyen por memoria.
    inyectarFallo('FROM ordenes o');
    try {
      await assert.rejects(VentasService.listarHistorial({}, admin, 'ADMINISTRADOR'), /FALLO_INYECTADO_BD/);
      comprobar(true, 'Historial: fallo de BD se propaga, no responde periodo vacío');
      await assert.rejects(VentasService.obtenerPorId(ordenes[1].id, admin, 'ADMINISTRADOR'), (e: any) => e.codigo !== 'ORDEN_NO_ENCONTRADA' && /FALLO_INYECTADO_BD/.test(e.message));
      comprobar(true, 'Detalle: fallo de BD se propaga, no se convierte en 404');
      await assert.rejects(VentasService.anularVenta(ordenes[1].id, 'Motivo A3', admin, 'ADMINISTRADOR'), /FALLO_INYECTADO_BD/);
      comprobar(true, 'Anulación: fallo de BD al leer la orden se propaga');
    } finally {
      restaurar();
    }
    comprobar((await VentasService.obtenerPorId(ordenes[1].id, admin, 'ADMINISTRADOR')).estado === 'CONFIRMADA', 'La orden sigue CONFIRMADA tras el fallo inyectado');

    // A3-4-03 y A3-4-02 en HTTP: sin identidad no se asume usuario 1; clave inválida en recuperación → 400.
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      const modo = req.headers['x-prueba-identidad'];
      if (modo === 'sin-id') req.usuario = { perfil: 'ADMINISTRADOR' };
      if (modo === 'caja') req.usuario = { id: caja, perfil: 'TRABAJADOR' };
      next();
    });
    app.use('/api/v1', ventasRouter);
    const servidor = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => servidor.once('listening', () => resolve()));
    const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api/v1`;
    try {
      const antes = await contar();
      const sinId = await fetch(`${base}/ventas/confirmar`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-prueba-identidad': 'sin-id' }, body: JSON.stringify(solicitud(randomUUID())) });
      comprobar(sinId.status === 401 && ((await sinId.json()) as any).codigo === 'NO_AUTENTICADO' && await contar() === antes, 'Sesión sin id de usuario → 401, sin venta a nombre de otra cuenta');
      const anularSinId = await fetch(`${base}/ventas/${ordenes[1].id}`, { headers: { 'x-prueba-identidad': 'sin-id' } });
      comprobar(anularSinId.status === 401, 'Consulta sin id de usuario → 401 sin perfil supuesto');
      const claveMala = await fetch(`${base}/ventas/recuperar/${'k'.repeat(101)}`, { headers: { 'x-prueba-identidad': 'caja' } });
      comprobar(claveMala.status === 400 && ((await claveMala.json()) as any).codigo === 'DATOS_INVALIDOS', 'Recuperar con clave inválida → 400 DATOS_INVALIDOS');
      const claveBuena = await fetch(`${base}/ventas/recuperar/${encodeURIComponent(claveLimite)}`, { headers: { 'x-prueba-identidad': 'caja' } });
      const cuerpo = await claveBuena.json() as any;
      comprobar(claveBuena.status === 200 && cuerpo.encontrada && cuerpo.orden.id === ordenLimite.id, 'Recuperar con clave válida propia → misma orden');
    } finally {
      await new Promise<void>((resolve) => servidor.close(() => resolve()));
    }

    comprobar(pool.idleCount === pool.totalCount && pool.waitingCount === 0, 'Pool sin clientes retenidos al terminar');
    console.log(`RESULTADO: ${comprobaciones}/${comprobaciones}.`);
  } finally {
    restaurar();
    await pool.end();
  }
}

run().catch((e: any) => {
  // No imprimir objetos pg, URL ni stack con configuración de conexión.
  console.error(`FAIL auditoría 3: ${e.code || e.codigo || e.name || 'ERROR'}; ${e instanceof assert.AssertionError ? e.message : 'revise el escenario en entorno aislado'}`);
  process.exitCode = 1;
});
