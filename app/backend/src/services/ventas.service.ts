import Decimal from 'decimal.js';
import { PoolClient } from 'pg';
import { pool } from '../config/database';
import {
  almacenMemoria,
  EstadoOrden,
  MetodoPago,
  OrdenInterna,
  PartidaOrdenInterna
} from './almacen-memoria';
import { InventarioService, ItemConsumoDTO } from './inventario.service';
import { PromocionesService, ResultadoCotizacionDTO } from './promociones.service';
import { CatalogoService } from './catalogo.service';

// Configuración de decimal.js según reglas de AGENTS.md
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export class ErrorVenta extends Error {
  constructor(
    public codigo: string,
    mensaje: string,
    public statusCode: number = 400,
    public detalles: any = null
  ) {
    super(mensaje);
    this.name = 'ErrorVenta';
  }
}

export interface PartidaOrdenDTO {
  id: number;
  platilloId: number;
  nombrePlatillo: string;
  precioUnitario: string;
  cantidad: number;
  unidadesCobradas: number;
  unidadesBonificadas: number;
  subtotalBruto: string;
  descuento: string;
  subtotalNeto: string;
  promocionId: number | null;
}

export interface PromocionSnapshotDTO {
  id: number | null;
  nombre: string | null;
  tipo: string | null;
  ahorro: string | null;
}

export interface OrdenDTO {
  id: number;
  folio: string;
  claveIdempotencia: string;
  usuarioId: number;
  nombreCajero: string;
  estado: EstadoOrden;
  metodoPago: MetodoPago;
  subtotalBruto: string;
  descuentoTotal: string;
  total: string;
  promocion: PromocionSnapshotDTO | null;
  partidas: PartidaOrdenDTO[];
  motivoAnulacion: string | null;
  usuarioAnulacionId: number | null;
  nombreUsuarioAnulacion: string | null;
  anuladoEn: string | null;
  creadoEn: string;
}

export interface ItemVentaInput {
  platilloId: number;
  cantidad: number;
}

export interface ConfirmarVentaInput {
  claveIdempotencia: string;
  metodoPago: MetodoPago;
  items: ItemVentaInput[];
  cotizacionAceptada: ResultadoCotizacionDTO;
}

export interface ResumenPeriodoVentasDTO {
  fechaInicio: string | null;
  fechaFin: string | null;
  cantidadConfirmadas: number;
  cantidadAnuladas: number;
  totalVentasConfirmadas: string;
  ordenes: OrdenDTO[];
}

export class VentasService {
  /**
   * Genera un folio formateado para la orden: ej. ORD-00001
   */
  private static formatearFolio(id: number): string {
    return `ORD-${String(id).padStart(5, '0')}`;
  }

  /**
   * CONFIRMAR VENTA TRANSACCIONALMENTE (W4-03 / Criterios CW-05, CW-06, CW-07, CW-14, CW-15)
   * 1. Verifica clave de idempotencia (CW-07).
   * 2. Revalida la consistencia de cotización contra el estado actual de la BD (CW-14).
   * 3. Valida método de pago y montos.
   * 4. Abre transacción atómica única (PoolClient con BEGIN/COMMIT/ROLLBACK).
   * 5. Inserta encabezado de orden y detalle de partidas (snapshots inmutables).
   * 6. Descuenta el inventario mediante InventarioService.descontarInventarioPorVenta (CW-05).
   * 7. En caso de error (ej. STOCK_INSUFICIENTE), ejecuta ROLLBACK sin efectos colaterales (CW-06).
   */
  static async confirmarVenta(input: ConfirmarVentaInput, usuarioId: number): Promise<OrdenDTO> {
    const { claveIdempotencia, metodoPago, items, cotizacionAceptada } = input;

    // 1. Validaciones básicas de entrada
    if (!claveIdempotencia || typeof claveIdempotencia !== 'string' || claveIdempotencia.trim().length === 0) {
      throw new ErrorVenta('DATOS_INVALIDOS', 'La clave de idempotencia es obligatoria para confirmar la venta.');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ErrorVenta('ORDEN_VACIA', 'La orden debe contener al menos un platillo.');
    }

    for (const it of items) {
      if (!Number.isInteger(it.platilloId) || it.platilloId <= 0) {
        throw new ErrorVenta('DATOS_INVALIDOS', 'El ID del platillo debe ser un entero positivo.');
      }
      if (!Number.isInteger(it.cantidad) || it.cantidad <= 0) {
        throw new ErrorVenta('DATOS_INVALIDOS', 'La cantidad del platillo debe ser un entero positivo.');
      }
    }

    if (!cotizacionAceptada || !cotizacionAceptada.partidas || cotizacionAceptada.partidas.length === 0) {
      throw new ErrorVenta('DATOS_INVALIDOS', 'La cotización aceptada es obligatoria.');
    }

    // 2. Validación de Método de Pago según importe total
    const totalDec = new Decimal(cotizacionAceptada.total);
    if (totalDec.isZero()) {
      if (metodoPago !== 'SIN_COBRO') {
        throw new ErrorVenta(
          'METODO_PAGO_INVALIDO',
          'Una orden con importe total $0.00 debe registrarse con método SIN_COBRO.'
        );
      }
    } else {
      if (metodoPago !== 'EFECTIVO' && metodoPago !== 'EXTERNO') {
        throw new ErrorVenta(
          'METODO_PAGO_INVALIDO',
          "El método de pago para órdenes con total mayor a cero debe ser 'EFECTIVO' o 'EXTERNO'."
        );
      }
    }

    // 3. Verificación de Idempotencia previa (Criterio CW-07)
    const ordenExistente = await this.buscarPorClaveIdempotencia(claveIdempotencia.trim());
    if (ordenExistente) {
      // Verificar si coincide el contenido
      const mismoUsuario = ordenExistente.usuarioId === usuarioId;
      const mismoTotal = ordenExistente.total === cotizacionAceptada.total;
      const mismasPartidas =
        ordenExistente.partidas.length === items.length &&
        items.every((it) => {
          const p = ordenExistente.partidas.find((p) => p.platilloId === it.platilloId);
          return p && p.cantidad === it.cantidad;
        });

      if (mismoUsuario && mismoTotal && mismasPartidas) {
        // Reintento legítimo / Doble clic / Respuesta perdida: retornar la misma orden
        return ordenExistente;
      } else {
        throw new ErrorVenta(
          'IDEMPOTENCIA_CONFLICTO',
          'La clave de idempotencia especificada ya fue utilizada para una venta diferente.',
          409
        );
      }
    }

    // 4. Revalidación Económica de Consistencia (Criterio CW-14)
    // Invoca PromocionesService para garantizar que ni precios ni promociones hayan cambiado
    const cotizacionValida = await PromocionesService.validarConsistenciaCotizacion(cotizacionAceptada);

    // 5. Preparar items de consumo para Inventario (Criterio CW-05 / CW-12)
    // La demanda total por platillo debe consumir las unidades físicas entregadas (q), incluyendo bonificadas
    const itemsConsumo: ItemConsumoDTO[] = cotizacionValida.partidas.map((p) => ({
      platilloId: p.platilloId,
      cantidadPlatillos: p.cantidad
    }));

    const ahora = new Date();
    const promoSnapshot = cotizacionValida.promocionAplicada;

    // 6. Ejecución Transaccional Atómica
    if (process.env.DATABASE_URL) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Insertar encabezado de la orden
        const queryOrden = `
          INSERT INTO ordenes (
            folio, clave_idempotencia, usuario_id, estado, metodo_pago,
            subtotal_bruto, descuento_total, total,
            promocion_id, promocion_nombre, promocion_tipo, promocion_ahorro,
            creado_en, actualizado_en
          ) VALUES (
            'PENDIENTE', $1, $2, 'CONFIRMADA', $3,
            $4, $5, $6,
            $7, $8, $9, $10,
            $11, $11
          ) RETURNING id;
        `;

        const resOrden = await client.query(queryOrden, [
          claveIdempotencia.trim(),
          usuarioId,
          metodoPago,
          cotizacionValida.subtotalBruto,
          cotizacionValida.descuentoTotal,
          cotizacionValida.total,
          promoSnapshot?.id || null,
          promoSnapshot?.nombre || null,
          promoSnapshot?.tipo || null,
          promoSnapshot?.ahorroTotal || null,
          ahora
        ]);

        const ordenId = resOrden.rows[0].id;
        const folioGenerado = this.formatearFolio(ordenId);

        // Actualizar folio con el número de orden asignado
        await client.query('UPDATE ordenes SET folio = $1 WHERE id = $2', [folioGenerado, ordenId]);

        // Insertar partidas de orden_detalle
        const queryDetalle = `
          INSERT INTO orden_detalle (
            orden_id, platillo_id, nombre_platillo, precio_unitario, cantidad,
            unidades_cobradas, unidades_bonificadas, subtotal_bruto, descuento,
            subtotal_neto, promocion_id, creado_en
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id;
        `;

        const partidasDTO: PartidaOrdenDTO[] = [];
        for (const p of cotizacionValida.partidas) {
          const resDet = await client.query(queryDetalle, [
            ordenId,
            p.platilloId,
            p.nombrePlatillo,
            p.precioUnitario,
            p.cantidad,
            p.unidadesCobradas,
            p.unidadesBonificadas,
            p.subtotalBruto,
            p.descuento,
            p.subtotalNeto,
            p.promocionAplicadaId,
            ahora
          ]);

          partidasDTO.push({
            id: resDet.rows[0].id,
            platilloId: p.platilloId,
            nombrePlatillo: p.nombrePlatillo,
            precioUnitario: p.precioUnitario,
            cantidad: p.cantidad,
            unidadesCobradas: p.unidadesCobradas,
            unidadesBonificadas: p.unidadesBonificadas,
            subtotalBruto: p.subtotalBruto,
            descuento: p.descuento,
            subtotalNeto: p.subtotalNeto,
            promocionId: p.promocionAplicadaId
          });
        }

        // Descontar inventario en la misma transacción (Criterios CW-05 y CW-06)
        await InventarioService.descontarInventarioPorVenta(client, ordenId, usuarioId, itemsConsumo);

        await client.query('COMMIT');

        // Obtener nombre del usuario cajero
        const userRes = await pool.query('SELECT nombre FROM usuarios WHERE id = $1', [usuarioId]);
        const nombreCajero = userRes.rows[0]?.nombre || `Usuario #${usuarioId}`;

        return {
          id: ordenId,
          folio: folioGenerado,
          claveIdempotencia: claveIdempotencia.trim(),
          usuarioId,
          nombreCajero,
          estado: 'CONFIRMADA',
          metodoPago,
          subtotalBruto: cotizacionValida.subtotalBruto,
          descuentoTotal: cotizacionValida.descuentoTotal,
          total: cotizacionValida.total,
          promocion: promoSnapshot
            ? {
                id: promoSnapshot.id,
                nombre: promoSnapshot.nombre,
                tipo: promoSnapshot.tipo,
                ahorro: promoSnapshot.ahorroTotal
              }
            : null,
          partidas: partidasDTO,
          motivoAnulacion: null,
          usuarioAnulacionId: null,
          nombreUsuarioAnulacion: null,
          anuladoEn: null,
          creadoEn: ahora.toISOString()
        };
      } catch (err: any) {
        await client.query('ROLLBACK');
        if (err instanceof ErrorVenta) throw err;
        throw err;
      } finally {
        client.release();
      }
    }

    // Modo Memoria (Fallback sin PostgreSQL)
    const ordenId = almacenMemoria.proxOrdenId++;
    const folioGenerado = this.formatearFolio(ordenId);

    const nuevaOrden: OrdenInterna = {
      id: ordenId,
      folio: folioGenerado,
      claveIdempotencia: claveIdempotencia.trim(),
      usuarioId,
      estado: 'CONFIRMADA',
      metodoPago,
      subtotalBruto: new Decimal(cotizacionValida.subtotalBruto),
      descuentoTotal: new Decimal(cotizacionValida.descuentoTotal),
      total: new Decimal(cotizacionValida.total),
      promocionId: promoSnapshot?.id || null,
      promocionNombre: promoSnapshot?.nombre || null,
      promocionTipo: promoSnapshot?.tipo || null,
      promocionAhorro: promoSnapshot ? new Decimal(promoSnapshot.ahorroTotal) : null,
      motivoAnulacion: null,
      usuarioAnulacionId: null,
      anuladoEn: null,
      creadoEn: ahora,
      actualizadoEn: ahora
    };

    const partidasDTO: PartidaOrdenDTO[] = [];
    const partidasInternas: PartidaOrdenInterna[] = [];

    for (const p of cotizacionValida.partidas) {
      const detId = almacenMemoria.proxOrdenDetalleId++;
      const detInterno: PartidaOrdenInterna = {
        id: detId,
        ordenId,
        platilloId: p.platilloId,
        nombrePlatillo: p.nombrePlatillo,
        precioUnitario: new Decimal(p.precioUnitario),
        cantidad: p.cantidad,
        unidadesCobradas: p.unidadesCobradas,
        unidadesBonificadas: p.unidadesBonificadas,
        subtotalBruto: new Decimal(p.subtotalBruto),
        descuento: new Decimal(p.descuento),
        subtotalNeto: new Decimal(p.subtotalNeto),
        promocionId: p.promocionAplicadaId,
        creadoEn: ahora
      };
      partidasInternas.push(detInterno);

      partidasDTO.push({
        id: detId,
        platilloId: p.platilloId,
        nombrePlatillo: p.nombrePlatillo,
        precioUnitario: p.precioUnitario,
        cantidad: p.cantidad,
        unidadesCobradas: p.unidadesCobradas,
        unidadesBonificadas: p.unidadesBonificadas,
        subtotalBruto: p.subtotalBruto,
        descuento: p.descuento,
        subtotalNeto: p.subtotalNeto,
        promocionId: p.promocionAplicadaId
      });
    }

    // Descontar inventario en memoria (lanzará STOCK_INSUFICIENTE si no alcanza)
    await InventarioService.descontarInventarioPorVenta(null, ordenId, usuarioId, itemsConsumo);

    // Solo si el descuento no lanzó error, persistimos la orden y partidas
    almacenMemoria.ordenes.push(nuevaOrden);
    almacenMemoria.ordenDetalles.push(...partidasInternas);

    return {
      id: ordenId,
      folio: folioGenerado,
      claveIdempotencia: claveIdempotencia.trim(),
      usuarioId,
      nombreCajero: `Usuario #${usuarioId}`,
      estado: 'CONFIRMADA',
      metodoPago,
      subtotalBruto: cotizacionValida.subtotalBruto,
      descuentoTotal: cotizacionValida.descuentoTotal,
      total: cotizacionValida.total,
      promocion: promoSnapshot
        ? {
            id: promoSnapshot.id,
            nombre: promoSnapshot.nombre,
            tipo: promoSnapshot.tipo,
            ahorro: promoSnapshot.ahorroTotal
          }
        : null,
      partidas: partidasDTO,
      motivoAnulacion: null,
      usuarioAnulacionId: null,
      nombreUsuarioAnulacion: null,
      anuladoEn: null,
      creadoEn: ahora.toISOString()
    };
  }

  /**
   * Busca una orden por su clave de idempotencia
   */
  static async buscarPorClaveIdempotencia(clave: string): Promise<OrdenDTO | null> {
    if (!clave) return null;

    if (process.env.DATABASE_URL) {
      try {
        const sql = `
          SELECT o.*, u.nombre AS nombre_cajero, ua.nombre AS nombre_usuario_anulacion
          FROM ordenes o
          LEFT JOIN usuarios u ON o.usuario_id = u.id
          LEFT JOIN usuarios ua ON o.usuario_anulacion_id = ua.id
          WHERE o.clave_idempotencia = $1;
        `;
        const res = await pool.query(sql, [clave]);
        if (res.rows.length === 0) return null;

        const o = res.rows[0];
        const detRes = await pool.query(
          `SELECT * FROM orden_detalle WHERE orden_id = $1 ORDER BY id ASC`,
          [o.id]
        );

        return this.mapearFilaADTO(o, detRes.rows);
      } catch (e) {
        console.warn('Fallback a memoria al buscar por clave idempotencia');
      }
    }

    const ord = almacenMemoria.ordenes.find((o) => o.claveIdempotencia === clave);
    if (!ord) return null;

    const partidas = almacenMemoria.ordenDetalles.filter((d) => d.ordenId === ord.id);
    return this.mapearInternoADTO(ord, partidas);
  }

  /**
   * Obtiene el detalle de una orden por ID con control de acceso
   */
  static async obtenerPorId(id: number, usuarioId: number, perfil: string): Promise<OrdenDTO> {
    let orden: OrdenDTO | null = null;

    if (process.env.DATABASE_URL) {
      try {
        const sql = `
          SELECT o.*, u.nombre AS nombre_cajero, ua.nombre AS nombre_usuario_anulacion
          FROM ordenes o
          LEFT JOIN usuarios u ON o.usuario_id = u.id
          LEFT JOIN usuarios ua ON o.usuario_anulacion_id = ua.id
          WHERE o.id = $1;
        `;
        const res = await pool.query(sql, [id]);
        if (res.rows.length > 0) {
          const o = res.rows[0];
          const detRes = await pool.query(
            `SELECT * FROM orden_detalle WHERE orden_id = $1 ORDER BY id ASC`,
            [o.id]
          );
          orden = this.mapearFilaADTO(o, detRes.rows);
        }
      } catch (e) {
        console.warn('Fallback a memoria al obtener orden por ID');
      }
    }

    if (!orden) {
      const ord = almacenMemoria.ordenes.find((o) => o.id === id);
      if (ord) {
        const partidas = almacenMemoria.ordenDetalles.filter((d) => d.ordenId === ord.id);
        orden = this.mapearInternoADTO(ord, partidas);
      }
    }

    if (!orden) {
      throw new ErrorVenta('ORDEN_NO_ENCONTRADA', `La orden con ID ${id} no existe.`, 404);
    }

    // Regla de acceso: Si es TRABAJADOR, solo puede consultar sus propias ventas
    if (perfil === 'TRABAJADOR' && orden.usuarioId !== usuarioId) {
      throw new ErrorVenta('ACCESO_DENEGADO', 'No tienes permiso para consultar ventas de otros usuarios.', 403);
    }

    return orden;
  }

  /**
   * LISTAR HISTORIAL Y RESUMEN DEL PERIODO (W4-04 / Criterios CW-02, CW-15, CW-16)
   * - TRABAJADOR: Ve únicamente sus propias ventas.
   * - ADMINISTRADOR: Ve todas las ventas.
   * - totalVentasConfirmadas suma exclusivamente ventas CONFIRMADAS; las ANULADAS se excluyen.
   */
  static async listarHistorial(
    filtro: { fechaInicio?: string; fechaFin?: string },
    usuarioId: number,
    perfil: string
  ): Promise<ResumenPeriodoVentasDTO> {
    const ordenesList: OrdenDTO[] = [];

    if (process.env.DATABASE_URL) {
      try {
        let sql = `
          SELECT o.*, u.nombre AS nombre_cajero, ua.nombre AS nombre_usuario_anulacion
          FROM ordenes o
          LEFT JOIN usuarios u ON o.usuario_id = u.id
          LEFT JOIN usuarios ua ON o.usuario_anulacion_id = ua.id
          WHERE 1=1
        `;
        const params: any[] = [];

        // Filtro por perfil
        if (perfil === 'TRABAJADOR') {
          params.push(usuarioId);
          sql += ` AND o.usuario_id = $${params.length}`;
        }

        // Filtro por rango de fechas (UTC)
        if (filtro.fechaInicio) {
          params.push(new Date(filtro.fechaInicio).toISOString());
          sql += ` AND o.creado_en >= $${params.length}`;
        }
        if (filtro.fechaFin) {
          params.push(new Date(filtro.fechaFin).toISOString());
          sql += ` AND o.creado_en <= $${params.length}`;
        }

        sql += ` ORDER BY o.creado_en DESC, o.id DESC;`;

        const res = await pool.query(sql, params);

        for (const row of res.rows) {
          const detRes = await pool.query(
            `SELECT * FROM orden_detalle WHERE orden_id = $1 ORDER BY id ASC`,
            [row.id]
          );
          ordenesList.push(this.mapearFilaADTO(row, detRes.rows));
        }

        return this.construirResumen(ordenesList, filtro.fechaInicio || null, filtro.fechaFin || null);
      } catch (e) {
        console.warn('Fallback a memoria al listar historial');
      }
    }

    // Memoria
    let lista = [...almacenMemoria.ordenes];

    if (perfil === 'TRABAJADOR') {
      lista = lista.filter((o) => o.usuarioId === usuarioId);
    }

    if (filtro.fechaInicio) {
      const ini = new Date(filtro.fechaInicio).getTime();
      lista = lista.filter((o) => o.creadoEn.getTime() >= ini);
    }
    if (filtro.fechaFin) {
      const fin = new Date(filtro.fechaFin).getTime();
      lista = lista.filter((o) => o.creadoEn.getTime() <= fin);
    }

    lista.sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime() || b.id - a.id);

    for (const ord of lista) {
      const partidas = almacenMemoria.ordenDetalles.filter((d) => d.ordenId === ord.id);
      ordenesList.push(this.mapearInternoADTO(ord, partidas));
    }

    return this.construirResumen(ordenesList, filtro.fechaInicio || null, filtro.fechaFin || null);
  }

  /**
   * ANULACIÓN SENCILLA DE VENTA (W4-05 / Criterio CW-16)
   * - Solo ADMINISTRADOR puede anular.
   * - Requiere motivo obligatorio.
   * - Es idempotente (si ya está anulada devuelve la orden existente).
   * - Conserva el registro original; no permite borrar ni editar partidas.
   * - No realiza reintegro automático de inventario (los insumos ya salieron físicamente).
   * - Excluye la orden del total vigente del periodo.
   */
  static async anularVenta(id: number, motivo: string, usuarioId: number, perfil: string): Promise<OrdenDTO> {
    if (perfil !== 'ADMINISTRADOR') {
      throw new ErrorVenta('ACCESO_DENEGADO', 'Solo los administradores pueden anular ventas.', 403);
    }

    const motivoTrim = motivo ? motivo.trim() : '';
    if (!motivoTrim) {
      throw new ErrorVenta('MOTIVO_REQUERIDO', 'El motivo de la anulación es obligatorio y no puede estar vacío.');
    }

    const orden = await this.obtenerPorId(id, usuarioId, perfil);

    // Idempotencia: si ya está ANULADA, retornar la misma
    if (orden.estado === 'ANULADA') {
      return orden;
    }

    const ahora = new Date();

    if (process.env.DATABASE_URL) {
      const sql = `
        UPDATE ordenes SET
          estado = 'ANULADA',
          motivo_anulacion = $1,
          usuario_anulacion_id = $2,
          anulado_en = $3,
          actualizado_en = $3
        WHERE id = $4
        RETURNING *;
      `;
      await pool.query(sql, [motivoTrim, usuarioId, ahora, id]);
      return this.obtenerPorId(id, usuarioId, perfil);
    }

    // Memoria
    const idx = almacenMemoria.ordenes.findIndex((o) => o.id === id);
    if (idx !== -1) {
      almacenMemoria.ordenes[idx].estado = 'ANULADA';
      almacenMemoria.ordenes[idx].motivoAnulacion = motivoTrim;
      almacenMemoria.ordenes[idx].usuarioAnulacionId = usuarioId;
      almacenMemoria.ordenes[idx].anuladoEn = ahora;
      almacenMemoria.ordenes[idx].actualizadoEn = ahora;
    }

    return this.obtenerPorId(id, usuarioId, perfil);
  }

  // ==========================================
  // HELPERS DE CÁLCULO Y MAPEO
  // ==========================================

  private static construirResumen(
    ordenes: OrdenDTO[],
    fechaInicio: string | null,
    fechaFin: string | null
  ): ResumenPeriodoVentasDTO {
    let cantConfirmadas = 0;
    let cantAnuladas = 0;
    let sumaTotalConfirmadas = new Decimal(0);

    for (const o of ordenes) {
      if (o.estado === 'CONFIRMADA') {
        cantConfirmadas++;
        sumaTotalConfirmadas = sumaTotalConfirmadas.plus(new Decimal(o.total));
      } else if (o.estado === 'ANULADA') {
        cantAnuladas++;
      }
    }

    return {
      fechaInicio,
      fechaFin,
      cantidadConfirmadas: cantConfirmadas,
      cantidadAnuladas: cantAnuladas,
      totalVentasConfirmadas: sumaTotalConfirmadas.toFixed(2),
      ordenes
    };
  }

  private static mapearFilaADTO(row: any, partidasRows: any[]): OrdenDTO {
    const partidas: PartidaOrdenDTO[] = partidasRows.map((r) => ({
      id: Number(r.id),
      platilloId: Number(r.platillo_id),
      nombrePlatillo: r.nombre_platillo,
      precioUnitario: new Decimal(r.precio_unitario).toFixed(2),
      cantidad: Number(r.cantidad),
      unidadesCobradas: Number(r.unidades_cobradas),
      unidadesBonificadas: Number(r.unidades_bonificadas || 0),
      subtotalBruto: new Decimal(r.subtotal_bruto).toFixed(2),
      descuento: new Decimal(r.descuento || 0).toFixed(2),
      subtotalNeto: new Decimal(r.subtotal_neto).toFixed(2),
      promocionId: r.promocion_id ? Number(r.promocion_id) : null
    }));

    return {
      id: Number(row.id),
      folio: row.folio,
      claveIdempotencia: row.clave_idempotencia,
      usuarioId: Number(row.usuario_id),
      nombreCajero: row.nombre_cajero || `Usuario #${row.usuario_id}`,
      estado: row.estado as EstadoOrden,
      metodoPago: row.metodo_pago as MetodoPago,
      subtotalBruto: new Decimal(row.subtotal_bruto).toFixed(2),
      descuentoTotal: new Decimal(row.descuento_total || 0).toFixed(2),
      total: new Decimal(row.total).toFixed(2),
      promocion: row.promocion_id
        ? {
            id: Number(row.promocion_id),
            nombre: row.promocion_nombre,
            tipo: row.promocion_tipo,
            ahorro: row.promocion_ahorro ? new Decimal(row.promocion_ahorro).toFixed(2) : null
          }
        : null,
      partidas,
      motivoAnulacion: row.motivo_anulacion || null,
      usuarioAnulacionId: row.usuario_anulacion_id ? Number(row.usuario_anulacion_id) : null,
      nombreUsuarioAnulacion: row.nombre_usuario_anulacion || null,
      anuladoEn: row.anulado_en ? new Date(row.anulado_en).toISOString() : null,
      creadoEn: new Date(row.creado_en).toISOString()
    };
  }

  private static mapearInternoADTO(ord: OrdenInterna, partidas: PartidaOrdenInterna[]): OrdenDTO {
    const partidasDTO: PartidaOrdenDTO[] = partidas.map((p) => ({
      id: p.id,
      platilloId: p.platilloId,
      nombrePlatillo: p.nombrePlatillo,
      precioUnitario: p.precioUnitario.toFixed(2),
      cantidad: p.cantidad,
      unidadesCobradas: p.unidadesCobradas,
      unidadesBonificadas: p.unidadesBonificadas,
      subtotalBruto: p.subtotalBruto.toFixed(2),
      descuento: p.descuento.toFixed(2),
      subtotalNeto: p.subtotalNeto.toFixed(2),
      promocionId: p.promocionId
    }));

    return {
      id: ord.id,
      folio: ord.folio,
      claveIdempotencia: ord.claveIdempotencia,
      usuarioId: ord.usuarioId,
      nombreCajero: `Usuario #${ord.usuarioId}`,
      estado: ord.estado,
      metodoPago: ord.metodoPago,
      subtotalBruto: ord.subtotalBruto.toFixed(2),
      descuentoTotal: ord.descuentoTotal.toFixed(2),
      total: ord.total.toFixed(2),
      promocion: ord.promocionId
        ? {
            id: ord.promocionId,
            nombre: ord.promocionNombre,
            tipo: ord.promocionTipo,
            ahorro: ord.promocionAhorro ? ord.promocionAhorro.toFixed(2) : null
          }
        : null,
      partidas: partidasDTO,
      motivoAnulacion: ord.motivoAnulacion,
      usuarioAnulacionId: ord.usuarioAnulacionId,
      nombreUsuarioAnulacion: ord.usuarioAnulacionId ? `Usuario #${ord.usuarioAnulacionId}` : null,
      anuladoEn: ord.anuladoEn ? ord.anuladoEn.toISOString() : null,
      creadoEn: ord.creadoEn.toISOString()
    };
  }
}
