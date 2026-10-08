import Decimal from 'decimal.js';
import { PoolClient } from 'pg';
import { pool } from '../config/database';
import { CatalogoService, ErrorCatalogo, UnidadIngrediente, validarNumeroDecimal } from './catalogo.service';
import { ejecutarTransaccion } from './db.service';
import { almacenMemoria, MovimientoInterno } from './almacen-memoria';

export type TipoMovimiento = 'ENTRADA' | 'AJUSTE' | 'CONSUMO_VENTA';

export interface MovimientoInventarioDTO {
  id: number;
  ingredienteId: number;
  nombreIngrediente: string;
  unidad: UnidadIngrediente;
  tipo: TipoMovimiento;
  cantidad: string; // Con signo (ejemplo: "+50.000", "-150.000", "+2", "-1")
  motivo: string;
  usuarioId: number;
  nombreUsuario: string;
  ordenId?: number | null;
  creadoEn: string; // ISO 8601 UTC
}

export interface RegistrarEntradaInput {
  ingredienteId: number;
  cantidad: string | number;
  motivo?: string;
  usuarioId: number;
}

export interface RegistrarAjusteInput {
  ingredienteId: number;
  cantidad: string | number;
  motivo: string;
  usuarioId: number;
}

export interface ItemConsumoDTO {
  platilloId: number;
  cantidadPlatillos: number;
}

// Bloqueo / serializador en memoria por ingrediente para prevenir carreras en pruebas aisladas sin BD
const locksMemoriaPorIngrediente = new Map<number, Promise<void>>();

async function ejecutarConBloqueoMemoria<T>(ingredienteId: number, fn: () => Promise<T>): Promise<T> {
  const lockPrevio = locksMemoriaPorIngrediente.get(ingredienteId) || Promise.resolve();
  let resolver: () => void;
  const nuevoLock = new Promise<void>((res) => {
    resolver = res;
  });
  locksMemoriaPorIngrediente.set(ingredienteId, nuevoLock);

  await lockPrevio;
  try {
    return await fn();
  } finally {
    resolver!();
  }
}

export class InventarioService {
  /**
   * Registra una entrada de mercancía al almacén.
   * Valida rigurosamente la cantidad y formato según la unidad.
   */
  static async registrarEntrada(input: RegistrarEntradaInput): Promise<MovimientoInventarioDTO> {
    const ingrediente = await CatalogoService.obtenerIngredientePorId(input.ingredienteId);
    if (!ingrediente) {
      throw new ErrorCatalogo('RECURSO_NO_ENCONTRADO', 'El ingrediente especificado no existe.', 404);
    }
    if (!ingrediente.activo) {
      throw new ErrorCatalogo('INGREDIENTE_INACTIVO', `El ingrediente "${ingrediente.nombre}" está inactivo y no admite movimientos.`);
    }

    const cantidadDec = CatalogoService.validarCantidadPorUnidad(input.cantidad, ingrediente.unidad, 'cantidad de entrada');
    if (cantidadDec.lte(0)) {
      throw new ErrorCatalogo('DATOS_INVALIDOS', 'La cantidad de una entrada de inventario debe ser un número positivo mayor a cero.');
    }

    const motivo = input.motivo?.trim() || 'Entrada regular de almacén';

    if (process.env.DATABASE_URL) {
      // Consulta directa a PostgreSQL sin fallback silencioso a memoria
      const query = `
        INSERT INTO movimientos_inventario (ingrediente_id, tipo, cantidad, motivo, usuario_id, creado_en)
        VALUES ($1, 'ENTRADA', $2, $3, $4, NOW() AT TIME ZONE 'UTC')
        RETURNING id, ingrediente_id, tipo, cantidad, motivo, usuario_id, orden_id, creado_en;
      `;
      const { rows } = await pool.query(query, [input.ingredienteId, cantidadDec.toString(), motivo, input.usuarioId]);
      const m = rows[0];

      const usuarioRes = await pool.query('SELECT nombre FROM usuarios WHERE id = $1', [input.usuarioId]);
      const nombreUsuario = usuarioRes.rows[0]?.nombre || 'Usuario ' + input.usuarioId;

      return {
        id: m.id,
        ingredienteId: m.ingrediente_id,
        nombreIngrediente: ingrediente.nombre,
        unidad: ingrediente.unidad,
        tipo: 'ENTRADA',
        cantidad: '+' + (ingrediente.unidad === 'pieza' ? cantidadDec.toFixed(0) : cantidadDec.toFixed(3)),
        motivo: m.motivo,
        usuarioId: m.usuario_id,
        nombreUsuario,
        ordenId: m.orden_id,
        creadoEn: new Date(m.creado_en).toISOString()
      };
    }

    // Almacén aislado exclusivo para pruebas sin BD
    const nuevoMov: MovimientoInterno = {
      id: almacenMemoria.proxMovimientoId++,
      ingredienteId: input.ingredienteId,
      tipo: 'ENTRADA',
      cantidad: cantidadDec,
      motivo,
      usuarioId: input.usuarioId,
      creadoEn: new Date()
    };
    almacenMemoria.movimientos.push(nuevoMov);

    return {
      id: nuevoMov.id,
      ingredienteId: nuevoMov.ingredienteId,
      nombreIngrediente: ingrediente.nombre,
      unidad: ingrediente.unidad,
      tipo: 'ENTRADA',
      cantidad: '+' + (ingrediente.unidad === 'pieza' ? cantidadDec.toFixed(0) : cantidadDec.toFixed(3)),
      motivo: nuevoMov.motivo,
      usuarioId: nuevoMov.usuarioId,
      nombreUsuario: 'Usuario ' + nuevoMov.usuarioId,
      ordenId: null,
      creadoEn: nuevoMov.creadoEn.toISOString()
    };
  }

  /**
   * Registra un ajuste de inventario (positivo o negativo) con motivo obligatorio.
   * Utiliza una transacción con bloqueo explícito FOR UPDATE para evitar condiciones de carrera,
   * garantizando que el stock resultante nunca sea negativo (Criterios CW-04 y CW-06).
   */
  static async registrarAjuste(input: RegistrarAjusteInput): Promise<MovimientoInventarioDTO> {
    const motivo = input.motivo?.trim();
    if (!motivo) {
      throw new ErrorCatalogo('DATOS_INVALIDOS', 'El motivo del ajuste es obligatorio y no puede estar vacío.');
    }

    if (process.env.DATABASE_URL) {
      return await ejecutarTransaccion(async (client: PoolClient) => {
        // 1. Bloquear y verificar el ingrediente con el mismo client
        const ingRes = await client.query(
          'SELECT id, nombre, unidad, minimo, activo FROM ingredientes WHERE id = $1 FOR UPDATE;',
          [input.ingredienteId]
        );
        if (ingRes.rows.length === 0) {
          throw new ErrorCatalogo('RECURSO_NO_ENCONTRADO', 'El ingrediente especificado no existe.', 404);
        }
        const ingrediente = ingRes.rows[0];
        if (!ingrediente.activo) {
          throw new ErrorCatalogo('INGREDIENTE_INACTIVO', `El ingrediente "${ingrediente.nombre}" está inactivo y no admite movimientos.`);
        }

        const cantidadDec = validarNumeroDecimal(input.cantidad, 'cantidad de ajuste', {
          entero: ingrediente.unidad === 'pieza',
          escalaMax: ingrediente.unidad === 'pieza' ? 0 : 3,
          permitirSignoExplicito: true,
          codigoError: 'DATOS_INVALIDOS'
        });

        if (cantidadDec.equals(0)) {
          throw new ErrorCatalogo('DATOS_INVALIDOS', 'La cantidad del ajuste no puede ser igual a cero.');
        }

        // 2. Con el ingrediente bloqueado, calcular existencia actual con el mismo cliente transaccional
        const saldoRes = await client.query(
          'SELECT COALESCE(SUM(cantidad), 0) AS balance FROM movimientos_inventario WHERE ingrediente_id = $1;',
          [input.ingredienteId]
        );
        const existenciaActual = new Decimal(saldoRes.rows[0].balance);
        const saldoProyectado = existenciaActual.plus(cantidadDec);

        if (saldoProyectado.lt(0)) {
          throw new ErrorCatalogo(
            'STOCK_NEGATIVO_NO_PERMITIDO',
            `El ajuste solicitado (${cantidadDec.toString()}) supera las existencias disponibles (${existenciaActual.toString()} ${ingrediente.unidad}). El stock nunca puede ser negativo.`
          );
        }

        // 3. Insertar el movimiento con el mismo cliente
        const insertQuery = `
          INSERT INTO movimientos_inventario (ingrediente_id, tipo, cantidad, motivo, usuario_id, creado_en)
          VALUES ($1, 'AJUSTE', $2, $3, $4, NOW() AT TIME ZONE 'UTC')
          RETURNING id, ingrediente_id, tipo, cantidad, motivo, usuario_id, orden_id, creado_en;
        `;
        const { rows } = await client.query(insertQuery, [input.ingredienteId, cantidadDec.toString(), motivo, input.usuarioId]);
        const m = rows[0];

        const usuarioRes = await client.query('SELECT nombre FROM usuarios WHERE id = $1', [input.usuarioId]);
        const nombreUsuario = usuarioRes.rows[0]?.nombre || 'Usuario ' + input.usuarioId;

        const signo = cantidadDec.gt(0) ? '+' : '';
        const formateado = ingrediente.unidad === 'pieza' ? cantidadDec.toFixed(0) : cantidadDec.toFixed(3);

        return {
          id: m.id,
          ingredienteId: m.ingrediente_id,
          nombreIngrediente: ingrediente.nombre,
          unidad: ingrediente.unidad,
          tipo: 'AJUSTE',
          cantidad: signo + formateado,
          motivo: m.motivo,
          usuarioId: m.usuario_id,
          nombreUsuario,
          ordenId: m.orden_id,
          creadoEn: new Date(m.creado_en).toISOString()
        };
      });
    }

    // Modo Memoria aislado con serialización/bloqueo por ingrediente para prevenir carreras
    return await ejecutarConBloqueoMemoria(input.ingredienteId, async () => {
      const ingrediente = await CatalogoService.obtenerIngredientePorId(input.ingredienteId);
      if (!ingrediente) {
        throw new ErrorCatalogo('RECURSO_NO_ENCONTRADO', 'El ingrediente especificado no existe.', 404);
      }
      if (!ingrediente.activo) {
        throw new ErrorCatalogo('INGREDIENTE_INACTIVO', `El ingrediente "${ingrediente.nombre}" está inactivo y no admite movimientos.`);
      }

      const cantidadDec = validarNumeroDecimal(input.cantidad, 'cantidad de ajuste', {
        entero: ingrediente.unidad === 'pieza',
        escalaMax: ingrediente.unidad === 'pieza' ? 0 : 3,
        permitirSignoExplicito: true,
        codigoError: 'DATOS_INVALIDOS'
      });

      if (cantidadDec.equals(0)) {
        throw new ErrorCatalogo('DATOS_INVALIDOS', 'La cantidad del ajuste no puede ser igual a cero.');
      }

      const existenciaActual = new Decimal(ingrediente.existencia);
      const saldoProyectado = existenciaActual.plus(cantidadDec);

      if (saldoProyectado.lt(0)) {
        throw new ErrorCatalogo(
          'STOCK_NEGATIVO_NO_PERMITIDO',
          `El ajuste solicitado (${cantidadDec.toString()}) supera las existencias disponibles (${existenciaActual.toString()} ${ingrediente.unidad}). El stock nunca puede ser negativo.`
        );
      }

      const nuevoMov: MovimientoInterno = {
        id: almacenMemoria.proxMovimientoId++,
        ingredienteId: input.ingredienteId,
        tipo: 'AJUSTE',
        cantidad: cantidadDec,
        motivo,
        usuarioId: input.usuarioId,
        creadoEn: new Date()
      };
      almacenMemoria.movimientos.push(nuevoMov);

      const signo = cantidadDec.gt(0) ? '+' : '';
      const formateado = ingrediente.unidad === 'pieza' ? cantidadDec.toFixed(0) : cantidadDec.toFixed(3);

      return {
        id: nuevoMov.id,
        ingredienteId: nuevoMov.ingredienteId,
        nombreIngrediente: ingrediente.nombre,
        unidad: ingrediente.unidad,
        tipo: 'AJUSTE',
        cantidad: signo + formateado,
        motivo: nuevoMov.motivo,
        usuarioId: nuevoMov.usuarioId,
        nombreUsuario: 'Usuario ' + nuevoMov.usuarioId,
        ordenId: null,
        creadoEn: nuevoMov.creadoEn.toISOString()
      };
    });
  }

  /**
   * Lista el historial cronológico de movimientos de inventario
   */
  static async listarMovimientos(ingredienteId?: number): Promise<MovimientoInventarioDTO[]> {
    if (process.env.DATABASE_URL) {
      let query = `
        SELECT 
          m.id,
          m.ingrediente_id,
          i.nombre AS nombre_ingrediente,
          i.unidad,
          m.tipo,
          m.cantidad,
          m.motivo,
          m.usuario_id,
          u.nombre AS nombre_usuario,
          m.orden_id,
          m.creado_en
        FROM movimientos_inventario m
        JOIN ingredientes i ON m.ingrediente_id = i.id
        LEFT JOIN usuarios u ON m.usuario_id = u.id
      `;
      const params: any[] = [];
      if (ingredienteId !== undefined) {
        query += ` WHERE m.ingrediente_id = $1`;
        params.push(ingredienteId);
      }
      query += ` ORDER BY m.creado_en DESC, m.id DESC;`;

      const { rows } = await pool.query(query, params);

      return rows.map((r) => {
        const cantDec = new Decimal(r.cantidad);
        const signo = cantDec.gt(0) ? '+' : '';
        const formateado = r.unidad === 'pieza' ? cantDec.toFixed(0) : cantDec.toFixed(3);

        return {
          id: r.id,
          ingredienteId: r.ingrediente_id,
          nombreIngrediente: r.nombre_ingrediente,
          unidad: r.unidad as UnidadIngrediente,
          tipo: r.tipo as TipoMovimiento,
          cantidad: signo + formateado,
          motivo: r.motivo,
          usuarioId: r.usuario_id,
          nombreUsuario: r.nombre_usuario || 'Usuario ' + r.usuario_id,
          ordenId: r.orden_id,
          creadoEn: new Date(r.creado_en).toISOString()
        };
      });
    }

    // Memoria aislada
    let movs = [...almacenMemoria.movimientos];
    if (ingredienteId !== undefined) {
      movs = movs.filter((m) => m.ingredienteId === ingredienteId);
    }
    movs.sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime() || b.id - a.id);

    return movs.map((m) => {
      const ing = almacenMemoria.ingredientes.find((i) => i.id === m.ingredienteId);
      const cantDec = m.cantidad;
      const signo = cantDec.gt(0) ? '+' : '';
      const unidad = ing?.unidad || 'pieza';
      const formateado = unidad === 'pieza' ? cantDec.toFixed(0) : cantDec.toFixed(3);

      return {
        id: m.id,
        ingredienteId: m.ingredienteId,
        nombreIngrediente: ing?.nombre || 'Ingrediente ' + m.ingredienteId,
        unidad,
        tipo: m.tipo,
        cantidad: signo + formateado,
        motivo: m.motivo,
        usuarioId: m.usuarioId,
        nombreUsuario: 'Usuario ' + m.usuarioId,
        ordenId: m.ordenId || null,
        creadoEn: m.creadoEn.toISOString()
      };
    });
  }

  /**
   * SERVICIO TRANSACCIONAL DE CONSUMO POR VENTA (CONTRATO W2-01 / W2-03)
   * Consume el inventario de toda una orden en la transacción compartida de ventas.
   * 1. Bloquea platillos y lee sus recetas de forma consistente en la misma transacción (Criterio W2-03 con W4-03).
   * 2. Bloquea filas en orden estable por ingrediente_id ASC para evitar deadlocks (CW-06).
   * 3. Lanza STOCK_INSUFICIENTE (409) si la existencia es insuficiente, provocando ROLLBACK total.
   */
  static async descontarInventarioPorVenta(
    client: PoolClient | null,
    ordenId: number,
    usuarioId: number,
    items: ItemConsumoDTO[]
  ): Promise<void> {
    if (!Array.isArray(items) || items.length === 0) {
      return;
    }

    // Validar cantidades de platillos
    for (const item of items) {
      validarNumeroDecimal(item.cantidadPlatillos, 'cantidad de platillos', {
        entero: true,
        positivo: true,
        codigoError: 'DATOS_INVALIDOS'
      });
    }

    const demandaAgregada = new Map<number, Decimal>();

    if (process.env.DATABASE_URL && client) {
      // 1. Obtener y bloquear los platillos en orden determinista para evitar mutaciones de receta durante cobro
      const platilloIds = Array.from(new Set(items.map((i) => i.platilloId))).sort((a, b) => a - b);

      const platillosBloqueadosRes = await client.query(
        'SELECT id, nombre, activo FROM platillos WHERE id = ANY($1) ORDER BY id FOR UPDATE;',
        [platilloIds]
      );

      const platillosMap = new Map<number, { id: number; nombre: string; activo: boolean }>();
      for (const p of platillosBloqueadosRes.rows) {
        platillosMap.set(p.id, p);
      }

      // 2. Leer recetas consistentes en la misma transacción mediante client
      const recetasRes = await client.query(
        `SELECT 
           r.platillo_id,
           r.ingrediente_id,
           r.cantidad,
           i.nombre AS nombre_ingrediente,
           i.unidad,
           i.activo AS ingrediente_activo
         FROM receta_detalle r
         JOIN ingredientes i ON r.ingrediente_id = i.id
         WHERE r.platillo_id = ANY($1)
         ORDER BY r.platillo_id, r.ingrediente_id;`,
        [platilloIds]
      );

      const recetasPorPlatillo = new Map<number, Array<{
        ingredienteId: number;
        nombreIngrediente: string;
        unidad: UnidadIngrediente;
        cantidad: string;
        activo: boolean;
      }>>();

      for (const r of recetasRes.rows) {
        if (!recetasPorPlatillo.has(r.platillo_id)) {
          recetasPorPlatillo.set(r.platillo_id, []);
        }
        recetasPorPlatillo.get(r.platillo_id)!.push({
          ingredienteId: r.ingrediente_id,
          nombreIngrediente: r.nombre_ingrediente,
          unidad: r.unidad,
          cantidad: r.cantidad,
          activo: r.ingrediente_activo
        });
      }

      // Validar cada platillo vendido
      for (const item of items) {
        const platilloInfo = platillosMap.get(item.platilloId);
        if (!platilloInfo) {
          throw new ErrorCatalogo('RECURSO_NO_ENCONTRADO', `El platillo con ID ${item.platilloId} no existe.`, 404);
        }
        if (!platilloInfo.activo) {
          throw new ErrorCatalogo('PLATILLO_INACTIVO', `El platillo "${platilloInfo.nombre}" está inactivo y no puede venderse.`);
        }

        const receta = recetasPorPlatillo.get(item.platilloId) || [];
        if (receta.length === 0 || !receta.every((ing) => ing.activo)) {
          throw new ErrorCatalogo('RECETA_INVALIDA', `El platillo "${platilloInfo.nombre}" no tiene una receta activa válida para la venta.`);
        }

        const cantPlatillosDec = new Decimal(item.cantidadPlatillos);

        for (const ingReceta of receta) {
          const cantPorPlatillo = new Decimal(ingReceta.cantidad);
          const consumoTotal = cantPorPlatillo.times(cantPlatillosDec);

          const actual = demandaAgregada.get(ingReceta.ingredienteId) || new Decimal(0);
          demandaAgregada.set(ingReceta.ingredienteId, actual.plus(consumoTotal));
        }
      }

      // 3. Bloqueo estable por ingrediente_id ASC (prevención de deadlocks, Criterio CW-06)
      const idsOrdenados = Array.from(demandaAgregada.keys()).sort((a, b) => a - b);

      const lockRes = await client.query(
        `SELECT id, nombre, unidad, activo FROM ingredientes WHERE id = ANY($1) ORDER BY id FOR UPDATE;`,
        [idsOrdenados]
      );

      const ingredientesMap = new Map<number, { nombre: string; unidad: UnidadIngrediente; activo: boolean }>();
      for (const row of lockRes.rows) {
        ingredientesMap.set(row.id, { nombre: row.nombre, unidad: row.unidad, activo: row.activo });
      }

      // 4. Validar existencias suficientes con bloqueo activo
      for (const ingId of idsOrdenados) {
        const ingInfo = ingredientesMap.get(ingId);
        if (!ingInfo || !ingInfo.activo) {
          throw new ErrorCatalogo(
            'INGREDIENTE_INACTIVO',
            `El ingrediente "${ingInfo?.nombre || ingId}" está inactivo y no puede consumirse.`
          );
        }

        const saldoRes = await client.query(
          `SELECT COALESCE(SUM(cantidad), 0) AS existencia FROM movimientos_inventario WHERE ingrediente_id = $1;`,
          [ingId]
        );
        const existenciaActual = new Decimal(saldoRes.rows[0].existencia);
        const demanda = demandaAgregada.get(ingId)!;

        if (existenciaActual.lt(demanda)) {
          throw new ErrorCatalogo(
            'STOCK_INSUFICIENTE',
            `Stock insuficiente para el ingrediente "${ingInfo.nombre}". Solicitado: ${demanda.toString()} ${ingInfo.unidad}, Disponible: ${existenciaActual.toString()} ${ingInfo.unidad}.`,
            409,
            {
              ingredienteId: ingId,
              nombreIngrediente: ingInfo.nombre,
              demandado: demanda.toString(),
              disponible: existenciaActual.toString()
            }
          );
        }
      }

      // 5. Insertar los consumos en la transacción
      for (const ingId of idsOrdenados) {
        const demanda = demandaAgregada.get(ingId)!;
        const cantNegativa = demanda.neg();
        const motivo = `Consumo por venta confirmada (Folio #${ordenId})`;

        await client.query(
          `INSERT INTO movimientos_inventario (ingrediente_id, tipo, cantidad, motivo, usuario_id, orden_id, creado_en)
           VALUES ($1, 'CONSUMO_VENTA', $2, $3, $4, $5, NOW() AT TIME ZONE 'UTC');`,
          [ingId, cantNegativa.toString(), motivo, usuarioId, ordenId]
        );
      }
      return;
    }

    // Modo Memoria aislado para pruebas unitarias sin BD
    for (const item of items) {
      const platillo = await CatalogoService.obtenerPlatilloPorId(item.platilloId);
      if (!platillo) {
        throw new ErrorCatalogo('RECURSO_NO_ENCONTRADO', `El platillo con ID ${item.platilloId} no existe.`, 404);
      }
      if (!platillo.activo) {
        throw new ErrorCatalogo('PLATILLO_INACTIVO', `El platillo "${platillo.nombre}" está inactivo y no puede venderse.`);
      }
      if (!platillo.recetaValida || !platillo.ingredientes || platillo.ingredientes.length === 0) {
        throw new ErrorCatalogo('RECETA_INVALIDA', `El platillo "${platillo.nombre}" no tiene una receta válida para venta.`);
      }

      const cantPlatillosDec = new Decimal(item.cantidadPlatillos);

      for (const ingReceta of platillo.ingredientes) {
        const cantPorPlatillo = new Decimal(ingReceta.cantidad);
        const consumoTotal = cantPorPlatillo.times(cantPlatillosDec);

        const actual = demandaAgregada.get(ingReceta.ingredienteId) || new Decimal(0);
        demandaAgregada.set(ingReceta.ingredienteId, actual.plus(consumoTotal));
      }
    }

    const idsOrdenados = Array.from(demandaAgregada.keys()).sort((a, b) => a - b);

    for (const ingId of idsOrdenados) {
      const ing = almacenMemoria.ingredientes.find((i) => i.id === ingId);
      if (!ing || !ing.activo) {
        throw new ErrorCatalogo(
          'INGREDIENTE_INACTIVO',
          `El ingrediente "${ing?.nombre || ingId}" está inactivo y no puede consumirse.`
        );
      }

      const existenciaActual = almacenMemoria.movimientos
        .filter((m) => m.ingredienteId === ingId)
        .reduce((acc, m) => acc.plus(m.cantidad), new Decimal(0));

      const demanda = demandaAgregada.get(ingId)!;

      if (existenciaActual.lt(demanda)) {
        throw new ErrorCatalogo(
          'STOCK_INSUFICIENTE',
          `Stock insuficiente para el ingrediente "${ing.nombre}". Solicitado: ${demanda.toString()} ${ing.unidad}, Disponible: ${existenciaActual.toString()} ${ing.unidad}.`,
          409,
          {
            ingredienteId: ingId,
            nombreIngrediente: ing.nombre,
            demandado: demanda.toString(),
            disponible: existenciaActual.toString()
          }
        );
      }
    }

    for (const ingId of idsOrdenados) {
      const demanda = demandaAgregada.get(ingId)!;
      const cantNegativa = demanda.neg();
      const motivo = `Consumo por venta confirmada (Folio #${ordenId})`;

      almacenMemoria.movimientos.push({
        id: almacenMemoria.proxMovimientoId++,
        ingredienteId: ingId,
        tipo: 'CONSUMO_VENTA',
        cantidad: cantNegativa,
        motivo,
        usuarioId,
        ordenId,
        creadoEn: new Date()
      });
    }
  }
}
