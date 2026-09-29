import Decimal from 'decimal.js';
import { PoolClient } from 'pg';
import { pool } from '../config/database';
import { CatalogoService, ErrorCatalogo, UnidadIngrediente, EstadoStock } from './catalogo.service';
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

export class InventarioService {
  /**
   * Registra una entrada de mercancía al almacén
   */
  static async registrarEntrada(input: RegistrarEntradaInput): Promise<MovimientoInventarioDTO> {
    const ingrediente = await CatalogoService.obtenerIngredientePorId(input.ingredienteId);
    if (!ingrediente) {
      throw new ErrorCatalogo('RECURSO_NO_ENCONTRADO', 'El ingrediente especificado no existe.', 404);
    }
    if (!ingrediente.activo) {
      throw new ErrorCatalogo('INGREDIENTE_INACTIVO', `El ingrediente "${ingrediente.nombre}" está inactivo y no admite movimientos.`);
    }

    const cantidadDec = new Decimal(input.cantidad);
    if (cantidadDec.lte(0)) {
      throw new ErrorCatalogo('DATOS_INVALIDOS', 'La cantidad de una entrada de inventario debe ser un número positivo mayor a cero.');
    }

    CatalogoService.validarCantidadPorUnidad(cantidadDec, ingrediente.unidad, 'cantidad de entrada');

    const motivo = input.motivo?.trim() || 'Entrada regular de almacén';

    if (process.env.DATABASE_URL) {
      try {
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
      } catch (e: any) {
        if (e instanceof ErrorCatalogo) throw e;
        console.warn('Fallback a memoria al registrar entrada de inventario');
      }
    }

    // Memoria
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
   * Garantiza que el stock resultante nunca sea negativo (CW-04).
   */
  static async registrarAjuste(input: RegistrarAjusteInput): Promise<MovimientoInventarioDTO> {
    const ingrediente = await CatalogoService.obtenerIngredientePorId(input.ingredienteId);
    if (!ingrediente) {
      throw new ErrorCatalogo('RECURSO_NO_ENCONTRADO', 'El ingrediente especificado no existe.', 404);
    }
    if (!ingrediente.activo) {
      throw new ErrorCatalogo('INGREDIENTE_INACTIVO', `El ingrediente "${ingrediente.nombre}" está inactivo y no admite movimientos.`);
    }

    const motivo = input.motivo?.trim();
    if (!motivo) {
      throw new ErrorCatalogo('DATOS_INVALIDOS', 'El motivo del ajuste es obligatorio y no puede estar vacío.');
    }

    const cantidadDec = new Decimal(input.cantidad);
    if (cantidadDec.equals(0)) {
      throw new ErrorCatalogo('DATOS_INVALIDOS', 'La cantidad del ajuste no puede ser igual a cero.');
    }

    CatalogoService.validarCantidadPorUnidad(cantidadDec.abs(), ingrediente.unidad, 'cantidad de ajuste');

    // Validación de stock no negativo: existencia_actual + ajuste >= 0
    const existenciaActual = new Decimal(ingrediente.existencia);
    const saldoProyectado = existenciaActual.plus(cantidadDec);

    if (saldoProyectado.lt(0)) {
      throw new ErrorCatalogo(
        'STOCK_NEGATIVO_NO_PERMITIDO',
        `El ajuste solicitado (${cantidadDec.toString()}) supera las existencias disponibles (${existenciaActual.toString()} ${ingrediente.unidad}). El stock nunca puede ser negativo.`
      );
    }

    if (process.env.DATABASE_URL) {
      try {
        const query = `
          INSERT INTO movimientos_inventario (ingrediente_id, tipo, cantidad, motivo, usuario_id, creado_en)
          VALUES ($1, 'AJUSTE', $2, $3, $4, NOW() AT TIME ZONE 'UTC')
          RETURNING id, ingrediente_id, tipo, cantidad, motivo, usuario_id, orden_id, creado_en;
        `;
        const { rows } = await pool.query(query, [input.ingredienteId, cantidadDec.toString(), motivo, input.usuarioId]);
        const m = rows[0];

        const usuarioRes = await pool.query('SELECT nombre FROM usuarios WHERE id = $1', [input.usuarioId]);
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
      } catch (e: any) {
        if (e instanceof ErrorCatalogo) throw e;
        console.warn('Fallback a memoria al registrar ajuste de inventario');
      }
    }

    // Memoria
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
  }

  /**
   * Lista el historial cronológico de movimientos de inventario
   */
  static async listarMovimientos(ingredienteId?: number): Promise<MovimientoInventarioDTO[]> {
    if (process.env.DATABASE_URL) {
      try {
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
      } catch (e) {
        console.warn('Fallback a memoria al listar movimientos');
      }
    }

    // Memoria
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
   * Bloquea filas en orden estable por ingrediente_id ASC para evitar deadlocks.
   * Lanza STOCK_INSUFICIENTE (409) si la existencia es insuficiente, provocando ROLLBACK.
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

    // 1. Agrupar la demanda agregada total por ingrediente
    const demandaAgregada = new Map<number, Decimal>();

    for (const item of items) {
      if (item.cantidadPlatillos <= 0) {
        continue;
      }

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

    // 2. Bloqueo estable por ingrediente_id ASC (prevención de deadlocks)
    const idsOrdenados = Array.from(demandaAgregada.keys()).sort((a, b) => a - b);

    if (process.env.DATABASE_URL && client) {
      // Bloquear filas en PostgreSQL
      const lockRes = await client.query(
        `SELECT id, nombre, unidad, activo FROM ingredientes WHERE id = ANY($1) ORDER BY id FOR UPDATE;`,
        [idsOrdenados]
      );

      const ingredientesMap = new Map<number, { nombre: string; unidad: UnidadIngrediente; activo: boolean }>();
      for (const row of lockRes.rows) {
        ingredientesMap.set(row.id, { nombre: row.nombre, unidad: row.unidad, activo: row.activo });
      }

      // 3. Validar estado activo y existencias suficientes
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

      // 4. Si todo es suficiente, insertar los consumos
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

    // Modo Memoria
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

    // Registrar en memoria
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
