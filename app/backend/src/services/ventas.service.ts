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
import { normalizarPeriodo } from './periodo-ventas';

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

export interface InsumoRecetaSnapshot {
  ingredienteId: number;
  nombreIngrediente: string;
  unidad: string;
  cantidadPorPlatillo: string;
  consumoTotal: string;
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
  recetaSnapshot?: InsumoRecetaSnapshot[] | null;
}

export interface PromocionSnapshotDTO {
  id: number | null;
  nombre: string | null;
  tipo: string | null;
  porcentaje: string | null;
  n: number | null;
  m: number | null;
  vigenciaInicio: string | null;
  vigenciaFin: string | null;
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

// Coincide con ordenes.clave_idempotencia VARCHAR(100); el navegador genera UUID v4 (36 caracteres).
const PATRON_CLAVE_IDEMPOTENCIA = /^[A-Za-z0-9_-]{1,100}$/;

export class VentasService {
  private static clavesEnVuelo = new Set<string>();

  /**
   * Valida la clave de idempotencia antes de consultar o escribir (A3-4-02).
   * Una clave fuera del formato se rechaza como DATOS_INVALIDOS en lugar de llegar a PostgreSQL como 22001.
   */
  static normalizarClaveIdempotencia(clave: unknown): string {
    const claveTrim = typeof clave === 'string' ? clave.trim() : '';
    if (!PATRON_CLAVE_IDEMPOTENCIA.test(claveTrim)) {
      throw new ErrorVenta(
        'DATOS_INVALIDOS',
        'La clave de idempotencia es obligatoria y debe tener de 1 a 100 caracteres alfanuméricos, guion o guion bajo.'
      );
    }
    return claveTrim;
  }

  /**
   * Genera un folio formateado para la orden: ej. ORD-00001
   */
  private static formatearFolio(id: number): string {
    return `ORD-${String(id).padStart(5, '0')}`;
  }

  /**
   * Valida la correspondencia estricta entre los items del carrito y las partidas de la cotización aceptada.
   * Resuelve el Hallazgo Crítico 1 (W4-03 / CW-07 / CW-14).
   */
  private static validarCorrespondenciaCarritoCotizacion(
    items: ItemVentaInput[],
    cotizacionAceptada: ResultadoCotizacionDTO
  ): void {
    const carritoConsolidado = new Map<number, number>();
    for (const it of items) {
      const cant = carritoConsolidado.get(it.platilloId) || 0;
      carritoConsolidado.set(it.platilloId, cant + it.cantidad);
    }

    const cotizacionConsolidada = new Map<number, number>();
    for (const p of cotizacionAceptada.partidas) {
      const cant = cotizacionConsolidada.get(p.platilloId) || 0;
      cotizacionConsolidada.set(p.platilloId, cant + p.cantidad);
    }

    if (carritoConsolidado.size !== cotizacionConsolidada.size) {
      throw new ErrorVenta(
        'DISCREPANCIA_CARRITO_COTIZACION',
        'El número de platillos distintos en el carrito no coincide con las partidas de la cotización aceptada.',
        400
      );
    }

    for (const [platilloId, cantidadCarrito] of carritoConsolidado.entries()) {
      const cantidadCotizada = cotizacionConsolidada.get(platilloId);
      if (cantidadCotizada === undefined || cantidadCotizada !== cantidadCarrito) {
        throw new ErrorVenta(
          'DISCREPANCIA_CARRITO_COTIZACION',
          `Discrepancia entre el carrito y la cotización para el platillo ID ${platilloId}: en carrito ${cantidadCarrito}, en cotización ${cantidadCotizada ?? 0}.`,
          400
        );
      }
    }
  }

  /**
   * Compara la huella completa de una solicitud contra una orden existente para resolver
   * reintentos legítimos de idempotencia o detectar conflictos de parámetros (Hallazgo Alta 3 / CW-07).
   */
  private static verificarReintentoIdempotente(
    ordenExistente: OrdenDTO,
    usuarioId: number,
    metodoPago: MetodoPago,
    items: ItemVentaInput[],
    cotizacionAceptada: ResultadoCotizacionDTO
  ): OrdenDTO {
    const mismoUsuario = ordenExistente.usuarioId === usuarioId;
    const mismoMetodo = ordenExistente.metodoPago === metodoPago;
    const mismoTotal = ordenExistente.total === cotizacionAceptada.total;

    const carritoConsolidado = new Map<number, number>();
    for (const it of items) {
      const cant = carritoConsolidado.get(it.platilloId) || 0;
      carritoConsolidado.set(it.platilloId, cant + it.cantidad);
    }

    const ordenConsolidada = new Map<number, number>();
    for (const p of ordenExistente.partidas) {
      const cant = ordenConsolidada.get(p.platilloId) || 0;
      ordenConsolidada.set(p.platilloId, cant + p.cantidad);
    }

    const mismasPartidas =
      carritoConsolidado.size === ordenConsolidada.size &&
      Array.from(carritoConsolidado.entries()).every(
        ([pid, cant]) => ordenConsolidada.get(pid) === cant
      );

    if (mismoUsuario && mismoMetodo && mismoTotal && mismasPartidas) {
      return ordenExistente;
    } else {
      throw new ErrorVenta(
        'IDEMPOTENCIA_CONFLICTO',
        'La clave de idempotencia especificada ya fue utilizada para una venta diferente.',
        409
      );
    }
  }

  /**
   * Normaliza los rangos de fechas para el filtrado de historial con soporte de cierre de día inclusivo
   * (Hallazgo Media 8 / W4-04).
   */
  private static parsearRangoFechas(filtro: { fechaInicio?: string; fechaFin?: string }): {
    fechaInicioISO: string | null;
    fechaFinISO: string | null;
    fechaFinExclusiva: boolean;
  } {
    try {
      return normalizarPeriodo(filtro);
    } catch {
      throw new ErrorVenta('PERIODO_INVALIDO', 'Fechas, rango o BUSINESS_TIME_ZONE inválidos.', 400);
    }
  }

  /**
   * CONFIRMAR VENTA TRANSACCIONALMENTE (W4-03 / Criterios CW-05, CW-06, CW-07, CW-14, CW-15)
   * 1. Verifica clave de idempotencia y huella completa (CW-07).
   * 2. Compara exactamente carrito contra partidas cotizadas (CW-07 / CW-14).
   * 3. Revalida la consistencia de cotización dentro de la transacción (CW-14).
   * 4. Valida método de pago y montos.
   * 5. Abre transacción atómica única (PoolClient con BEGIN/COMMIT/ROLLBACK).
   * 6. Inserta encabezado de orden y detalle con snapshots históricos completos (CW-15).
   * 7. Descuenta el inventario mediante InventarioService.descontarInventarioPorVenta (CW-05).
   * 8. Serializa la clave de idempotencia y reconsulta con el mismo cliente (CW-07).
   */
  static async confirmarVenta(input: ConfirmarVentaInput, usuarioId: number): Promise<OrdenDTO> {
    const { metodoPago, items, cotizacionAceptada } = input;

    // 1. Validaciones básicas de entrada
    const claveIdempotencia = this.normalizarClaveIdempotencia(input.claveIdempotencia);

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

    // 2. Verificación de Idempotencia previa con huella íntegra (Hallazgo Alta 3 / CW-07)
    const ordenExistente = await this.buscarPorClaveIdempotencia(claveIdempotencia.trim());
    if (ordenExistente) {
      return this.verificarReintentoIdempotente(ordenExistente, usuarioId, metodoPago, items, cotizacionAceptada);
    }

    // 3. Validación estricta de correspondencia entre Carrito y Cotización Aceptada (Hallazgo Crítico 1 / CW-07 / CW-14)
    this.validarCorrespondenciaCarritoCotizacion(items, cotizacionAceptada);

    // 4. Validación de Método de Pago según importe total
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

    const ahora = new Date();

    // 5. Ejecución Transaccional Atómica (PostgreSQL Real)
    if (process.env.DATABASE_URL) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Serializar la identidad antes de tomar bloqueos de catálogo/inventario.
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 4))', [claveIdempotencia.trim()]);
        const existente = await this.buscarPorClaveIdempotencia(claveIdempotencia.trim(), client);
        if (existente) {
          const resultado = this.verificarReintentoIdempotente(existente, usuarioId, metodoPago, items, cotizacionAceptada);
          await client.query('COMMIT');
          return resultado;
        }

        // Hallazgo Alta 4 / CW-14: Revalidar consistencia de cotización DENTRO de la transacción
        // con bloqueo determinista ordenado en los registros participantes
        const cotizacionValida = await PromocionesService.validarConsistenciaCotizacion(
          cotizacionAceptada,
          client,
          true
        );

        if (cotizacionValida.total !== cotizacionAceptada.total) {
          throw new ErrorVenta(
            'COTIZACION_DESACTUALIZADA',
            'Las condiciones económicas o de precios cambiaron durante la confirmación. Por favor revalida la cotización.',
            409
          );
        }

        const promoSnapshot = cotizacionValida.promocionAplicada;

        // Consultar recetas de los platillos vendidos en la misma transacción para el snapshot histórico
        const platilloIds = Array.from(new Set(items.map((i) => i.platilloId))).sort((a, b) => a - b);
        const recetasRes = await client.query(
          `SELECT r.platillo_id, r.ingrediente_id, r.cantidad, i.nombre AS nombre_ingrediente, i.unidad
           FROM receta_detalle r
           JOIN ingredientes i ON r.ingrediente_id = i.id
           WHERE r.platillo_id = ANY($1)
           ORDER BY r.platillo_id, r.ingrediente_id;`,
          [platilloIds]
        );

        const recetasPorPlatillo = new Map<number, Array<{
          ingredienteId: number;
          nombreIngrediente: string;
          unidad: string;
          cantidad: string;
        }>>();

        for (const r of recetasRes.rows) {
          if (!recetasPorPlatillo.has(r.platillo_id)) {
            recetasPorPlatillo.set(r.platillo_id, []);
          }
          recetasPorPlatillo.get(r.platillo_id)!.push({
            ingredienteId: r.ingrediente_id,
            nombreIngrediente: r.nombre_ingrediente,
            unidad: r.unidad,
            cantidad: r.cantidad
          });
        }

        // Consultar vigencia de la promoción participante si existe
        let vigenciaInicioDb: string | null = null;
        let vigenciaFinDb: string | null = null;
        if (promoSnapshot?.id) {
          const prRes = await client.query('SELECT fecha_inicio, fecha_fin FROM promociones WHERE id = $1', [
            promoSnapshot.id
          ]);
          if (prRes.rows.length > 0) {
            vigenciaInicioDb = prRes.rows[0].fecha_inicio ? new Date(prRes.rows[0].fecha_inicio).toISOString() : null;
            vigenciaFinDb = prRes.rows[0].fecha_fin ? new Date(prRes.rows[0].fecha_fin).toISOString() : null;
          }
        }

        // Insertar encabezado de la orden con snapshot promocional completo (Hallazgo Alta 7 / CW-15)
        const queryOrden = `
          INSERT INTO ordenes (
            folio, clave_idempotencia, usuario_id, estado, metodo_pago,
            subtotal_bruto, descuento_total, total,
            promocion_id, promocion_nombre, promocion_tipo,
            promocion_porcentaje, promocion_n, promocion_m,
            promocion_vigencia_inicio, promocion_vigencia_fin,
            promocion_ahorro,
            creado_en, actualizado_en
          ) VALUES (
            'PENDIENTE', $1, $2, 'CONFIRMADA', $3,
            $4, $5, $6,
            $7, $8, $9,
            $10, $11, $12,
            $13, $14,
            $15,
            $16, $16
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
          promoSnapshot?.porcentaje || null,
          promoSnapshot?.n || null,
          promoSnapshot?.m || null,
          vigenciaInicioDb,
          vigenciaFinDb,
          promoSnapshot?.ahorroTotal || null,
          ahora
        ]);

        const ordenId = resOrden.rows[0].id;
        const folioGenerado = this.formatearFolio(ordenId);

        // Actualizar folio con el número de orden asignado
        await client.query('UPDATE ordenes SET folio = $1 WHERE id = $2', [folioGenerado, ordenId]);

        // Insertar partidas de orden_detalle con snapshot de receta por partida (Hallazgo Alta 7 / CW-15)
        const queryDetalle = `
          INSERT INTO orden_detalle (
            orden_id, platillo_id, nombre_platillo, precio_unitario, cantidad,
            unidades_cobradas, unidades_bonificadas, subtotal_bruto, descuento,
            subtotal_neto, promocion_id, receta_snapshot, creado_en
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING id;
        `;

        const partidasDTO: PartidaOrdenDTO[] = [];
        for (const p of cotizacionValida.partidas) {
          const ingredientesReceta = recetasPorPlatillo.get(p.platilloId) || [];
          const recetaSnap: InsumoRecetaSnapshot[] = ingredientesReceta.map((ing) => ({
            ingredienteId: ing.ingredienteId,
            nombreIngrediente: ing.nombreIngrediente,
            unidad: ing.unidad,
            cantidadPorPlatillo: ing.cantidad,
            consumoTotal: new Decimal(ing.cantidad).times(p.cantidad).toString()
          }));

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
            JSON.stringify(recetaSnap),
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
            promocionId: p.promocionAplicadaId,
            recetaSnapshot: recetaSnap
          });
        }

        // Descontar inventario en la misma transacción (Criterios CW-05 y CW-06)
        const itemsConsumo: ItemConsumoDTO[] = cotizacionValida.partidas.map((p) => ({
          platilloId: p.platilloId,
          cantidadPlatillos: p.cantidad
        }));
        await InventarioService.descontarInventarioPorVenta(client, ordenId, usuarioId, itemsConsumo);

        // Construir la respuesta con el mismo cliente, antes del COMMIT.
        const userRes = await client.query('SELECT nombre FROM usuarios WHERE id = $1', [usuarioId]);
        const nombreCajero = userRes.rows[0]?.nombre || `Usuario #${usuarioId}`;

        await client.query('COMMIT');

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
                porcentaje: promoSnapshot.porcentaje || null,
                n: promoSnapshot.n || null,
                m: promoSnapshot.m || null,
                vigenciaInicio: vigenciaInicioDb,
                vigenciaFin: vigenciaFinDb,
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
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    }

    // 6. Modo Memoria (Fallback sin PostgreSQL)
    const claveTrim = claveIdempotencia.trim();

    // Si ya existe la orden en memoria, devolver reintento o lanzar conflicto
    const ordenExistenteMem = almacenMemoria.ordenes.find((o) => o.claveIdempotencia === claveTrim);
    if (ordenExistenteMem) {
      const dto = this.mapearInternoADTO(
        ordenExistenteMem,
        almacenMemoria.ordenDetalles.filter((d) => d.ordenId === ordenExistenteMem.id)
      );
      return this.verificarReintentoIdempotente(dto, usuarioId, metodoPago, items, cotizacionAceptada);
    }

    // Si hay una operación concurrente en vuelo con esta clave, esperar a que finalice
    if (VentasService.clavesEnVuelo.has(claveTrim)) {
      while (VentasService.clavesEnVuelo.has(claveTrim)) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      const ordConcurrente = almacenMemoria.ordenes.find((o) => o.claveIdempotencia === claveTrim);
      if (ordConcurrente) {
        const dto = this.mapearInternoADTO(
          ordConcurrente,
          almacenMemoria.ordenDetalles.filter((d) => d.ordenId === ordConcurrente.id)
        );
        return this.verificarReintentoIdempotente(dto, usuarioId, metodoPago, items, cotizacionAceptada);
      }
    }

    VentasService.clavesEnVuelo.add(claveTrim);
    try {
      // Revalidación económica consistente en memoria
      const cotizacionValida = await PromocionesService.validarConsistenciaCotizacion(cotizacionAceptada);

      if (cotizacionValida.total !== cotizacionAceptada.total) {
        throw new ErrorVenta(
          'COTIZACION_DESACTUALIZADA',
          'Las condiciones económicas o de precios cambiaron durante la confirmación. Por favor revalida la cotización.',
          409
        );
      }

      const promoSnapshot = cotizacionValida.promocionAplicada;
      const itemsConsumo: ItemConsumoDTO[] = cotizacionValida.partidas.map((p) => ({
        platilloId: p.platilloId,
        cantidadPlatillos: p.cantidad
      }));

      const ordenId = almacenMemoria.proxOrdenId++;
      const folioGenerado = this.formatearFolio(ordenId);

    // Preparar snapshot de recetas en memoria
    const partidasDTO: PartidaOrdenDTO[] = [];
    const partidasInternas: PartidaOrdenInterna[] = [];

    for (const p of cotizacionValida.partidas) {
      const detId = almacenMemoria.proxOrdenDetalleId++;
      const ingredientesReceta = almacenMemoria.recetas
        .filter((r) => r.platilloId === p.platilloId)
        .map((r) => {
          const ing = almacenMemoria.ingredientes.find((i) => i.id === r.ingredienteId);
          return {
            ingredienteId: r.ingredienteId,
            nombreIngrediente: ing?.nombre || `Ingrediente #${r.ingredienteId}`,
            unidad: ing?.unidad || 'unidad',
            cantidadPorPlatillo: r.cantidad.toString(),
            consumoTotal: r.cantidad.times(p.cantidad).toString()
          };
        });

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
        recetaSnapshot: ingredientesReceta,
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
        promocionId: p.promocionAplicadaId,
        recetaSnapshot: ingredientesReceta
      });
    }

    // Descontar inventario en memoria primero (lanzará STOCK_INSUFICIENTE si no alcanza, simulando rollback)
    await InventarioService.descontarInventarioPorVenta(null, ordenId, usuarioId, itemsConsumo);

    let vigenciaInicioMem: Date | null = null;
    let vigenciaFinMem: Date | null = null;
    if (promoSnapshot?.id) {
      const prMem = almacenMemoria.promociones.find((pr) => pr.id === promoSnapshot.id);
      vigenciaInicioMem = prMem?.fechaInicio || null;
      vigenciaFinMem = prMem?.fechaFin || null;
    }

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
      promocionPorcentaje: promoSnapshot?.porcentaje ? new Decimal(promoSnapshot.porcentaje) : null,
      promocionN: promoSnapshot?.n || null,
      promocionM: promoSnapshot?.m || null,
      promocionVigenciaInicio: vigenciaInicioMem,
      promocionVigenciaFin: vigenciaFinMem,
      promocionAhorro: promoSnapshot ? new Decimal(promoSnapshot.ahorroTotal) : null,
      motivoAnulacion: null,
      usuarioAnulacionId: null,
      anuladoEn: null,
      creadoEn: ahora,
      actualizadoEn: ahora
    };

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
            porcentaje: promoSnapshot.porcentaje || null,
            n: promoSnapshot.n || null,
            m: promoSnapshot.m || null,
            vigenciaInicio: vigenciaInicioMem ? vigenciaInicioMem.toISOString() : null,
            vigenciaFin: vigenciaFinMem ? vigenciaFinMem.toISOString() : null,
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
    } finally {
      VentasService.clavesEnVuelo.delete(claveTrim);
    }
  }

  /**
   * Busca una orden por su clave de idempotencia
   */
  static async buscarPorClaveIdempotencia(clave: string, clienteDb?: PoolClient): Promise<OrdenDTO | null> {
    if (!clave) return null;

    if (process.env.DATABASE_URL) {
      const db = clienteDb || pool;
      const sql = `
        SELECT o.*, u.nombre AS nombre_cajero, ua.nombre AS nombre_usuario_anulacion
        FROM ordenes o
        LEFT JOIN usuarios u ON o.usuario_id = u.id
        LEFT JOIN usuarios ua ON o.usuario_anulacion_id = ua.id
        WHERE o.clave_idempotencia = $1;
      `;
      const res = await db.query(sql, [clave]);
      if (res.rows.length === 0) return null;

      const o = res.rows[0];
      const detRes = await db.query(
        `SELECT * FROM orden_detalle WHERE orden_id = $1 ORDER BY id ASC`,
        [o.id]
      );

      return this.mapearFilaADTO(o, detRes.rows);
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
      // A3-4-01: un fallo de PostgreSQL se propaga; no se sustituye por datos en memoria ni por 404.
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
    } else {
      const ord = almacenMemoria.ordenes.find((o) => o.id === id);
      if (ord) {
        const partidas = almacenMemoria.ordenDetalles.filter((d) => d.ordenId === ord.id);
        orden = this.mapearInternoADTO(ord, partidas);
      }
    }

    if (!orden) {
      throw new ErrorVenta('ORDEN_NO_ENCONTRADA', `La orden con ID ${id} no existe.`, 404);
    }

    // Regla de acceso: Si es TRABAJADOR, solo puede consultar sus propias ventas (CW-02)
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
   * - Soporta filtro de fecha con cierre de día inclusivo (Hallazgo Media 8).
   */
  static async listarHistorial(
    filtro: { fechaInicio?: string; fechaFin?: string },
    usuarioId: number,
    perfil: string
  ): Promise<ResumenPeriodoVentasDTO> {
    const ordenesList: OrdenDTO[] = [];
    const { fechaInicioISO, fechaFinISO, fechaFinExclusiva } = this.parsearRangoFechas(filtro);

    if (process.env.DATABASE_URL) {
      // A3-4-01: un fallo de PostgreSQL se propaga como error; nunca se responde un periodo vacío desde memoria.
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

      // Días civiles del negocio: fin exclusivo al inicio del día siguiente.
      if (fechaInicioISO) {
        params.push(fechaInicioISO);
        sql += ` AND o.creado_en >= $${params.length}`;
      }
      if (fechaFinISO) {
        params.push(fechaFinISO);
        sql += ` AND o.creado_en ${fechaFinExclusiva ? '<' : '<='} $${params.length}`;
      }

      sql += ` ORDER BY o.creado_en DESC, o.id DESC;`;

      const res = await pool.query(sql, params);

      // A3-4-04: una sola consulta de partidas para todo el periodo, en lugar de una por orden.
      const partidasPorOrden = new Map<number, any[]>();
      if (res.rows.length > 0) {
        const detRes = await pool.query(
          `SELECT * FROM orden_detalle WHERE orden_id = ANY($1) ORDER BY orden_id ASC, id ASC`,
          [res.rows.map((row) => row.id)]
        );
        for (const det of detRes.rows) {
          const ordenId = Number(det.orden_id);
          if (!partidasPorOrden.has(ordenId)) partidasPorOrden.set(ordenId, []);
          partidasPorOrden.get(ordenId)!.push(det);
        }
      }

      for (const row of res.rows) {
        ordenesList.push(this.mapearFilaADTO(row, partidasPorOrden.get(Number(row.id)) || []));
      }

      return this.construirResumen(ordenesList, filtro.fechaInicio || null, filtro.fechaFin || null);
    }

    // Memoria
    let lista = [...almacenMemoria.ordenes];

    if (perfil === 'TRABAJADOR') {
      lista = lista.filter((o) => o.usuarioId === usuarioId);
    }

    if (fechaInicioISO) {
      const ini = new Date(fechaInicioISO).getTime();
      lista = lista.filter((o) => o.creadoEn.getTime() >= ini);
    }
    if (fechaFinISO) {
      const fin = new Date(fechaFinISO).getTime();
      lista = lista.filter((o) => fechaFinExclusiva ? o.creadoEn.getTime() < fin : o.creadoEn.getTime() <= fin);
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
   * - Es estrictamente atómica e idempotente (WHERE estado = 'CONFIRMADA').
   * - Previene sobreescrituras en carreras concurrentes de anulación (Hallazgo Alta 5).
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

    // Idempotencia: si ya está ANULADA, retornar la misma sin modificar motivo ni autor
    if (orden.estado === 'ANULADA') {
      return orden;
    }

    const ahora = new Date();

    if (process.env.DATABASE_URL) {
      // Actualización condicional atómica: solo altera si el estado actual es CONFIRMADA
      const sql = `
        UPDATE ordenes SET
          estado = 'ANULADA',
          motivo_anulacion = $1,
          usuario_anulacion_id = $2,
          anulado_en = $3,
          actualizado_en = $3
        WHERE id = $4 AND estado = 'CONFIRMADA'
        RETURNING *;
      `;
      const updateRes = await pool.query(sql, [motivoTrim, usuarioId, ahora, id]);

      if (updateRes.rows.length === 0) {
        // En concurrencia, otra transacción ya ejecutó la anulación: devolver el registro original
        return this.obtenerPorId(id, usuarioId, perfil);
      }

      return this.obtenerPorId(id, usuarioId, perfil);
    }

    // Memoria: protección atómica condicional
    const idx = almacenMemoria.ordenes.findIndex((o) => o.id === id);
    if (idx === -1) {
      throw new ErrorVenta('ORDEN_NO_ENCONTRADA', `La orden con ID ${id} no existe.`, 404);
    }

    // Si ya fue anulada por otra llamada concurrente, devolver intacta
    if (almacenMemoria.ordenes[idx].estado === 'ANULADA') {
      return this.obtenerPorId(id, usuarioId, perfil);
    }

    almacenMemoria.ordenes[idx].estado = 'ANULADA';
    almacenMemoria.ordenes[idx].motivoAnulacion = motivoTrim;
    almacenMemoria.ordenes[idx].usuarioAnulacionId = usuarioId;
    almacenMemoria.ordenes[idx].anuladoEn = ahora;
    almacenMemoria.ordenes[idx].actualizadoEn = ahora;

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
    const partidas: PartidaOrdenDTO[] = partidasRows.map((r) => {
      let recetaParsed: InsumoRecetaSnapshot[] | null = null;
      if (r.receta_snapshot) {
        recetaParsed = typeof r.receta_snapshot === 'string' ? JSON.parse(r.receta_snapshot) : r.receta_snapshot;
      }

      return {
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
        promocionId: r.promocion_id ? Number(r.promocion_id) : null,
        recetaSnapshot: recetaParsed
      };
    });

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
            porcentaje: row.promocion_porcentaje ? new Decimal(row.promocion_porcentaje).toFixed(2) : null,
            n: row.promocion_n !== null && row.promocion_n !== undefined ? Number(row.promocion_n) : null,
            m: row.promocion_m !== null && row.promocion_m !== undefined ? Number(row.promocion_m) : null,
            vigenciaInicio: row.promocion_vigencia_inicio ? new Date(row.promocion_vigencia_inicio).toISOString() : null,
            vigenciaFin: row.promocion_vigencia_fin ? new Date(row.promocion_vigencia_fin).toISOString() : null,
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
      promocionId: p.promocionId,
      recetaSnapshot: p.recetaSnapshot || null
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
            porcentaje: ord.promocionPorcentaje ? ord.promocionPorcentaje.toFixed(2) : null,
            n: ord.promocionN || null,
            m: ord.promocionM || null,
            vigenciaInicio: ord.promocionVigenciaInicio ? ord.promocionVigenciaInicio.toISOString() : null,
            vigenciaFin: ord.promocionVigenciaFin ? ord.promocionVigenciaFin.toISOString() : null,
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
