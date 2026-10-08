import Decimal from 'decimal.js';
import { Pool, PoolClient } from 'pg';
import { pool } from '../config/database';
import {
  almacenMemoria,
  TipoPromocion,
  DuracionPromocion,
  EstadoPromocion,
  PromocionInterna
} from './almacen-memoria';
import { CatalogoService } from './catalogo.service';

// Configuración global de decimal.js según reglas de AGENTS.md (Round Half-Up)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export class ErrorPromocion extends Error {
  constructor(
    public codigo: string,
    mensaje: string,
    public statusCode: number = 400,
    public detalles: any = null
  ) {
    super(mensaje);
    this.name = 'ErrorPromocion';
  }
}

export interface PromocionDTO {
  id: number;
  nombre: string;
  platilloId: number;
  nombrePlatillo: string;
  precioPlatillo: string;
  tipo: TipoPromocion;
  porcentaje: string | null;
  n: number | null;
  m: number | null;
  duracion: DuracionPromocion;
  fechaInicio: string | null;
  fechaFin: string | null;
  estado: EstadoPromocion;
  vigente: boolean;
  usuarioId: number;
  creadoEn: string;
  actualizadoEn: string;
}

export interface CrearPromocionInput {
  nombre: string;
  platilloId: number;
  tipo: TipoPromocion;
  porcentaje?: string | number | null;
  n?: number | null;
  m?: number | null;
  duracion: DuracionPromocion;
  fechaInicio?: string | null;
  fechaFin?: string | null;
}

export interface ActualizarPromocionInput {
  nombre?: string;
  platilloId?: number;
  tipo?: TipoPromocion;
  porcentaje?: string | number | null;
  n?: number | null;
  m?: number | null;
  duracion?: DuracionPromocion;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  estado?: EstadoPromocion;
}

export interface ItemCotizacionInput {
  platilloId: number;
  cantidad: number;
}

export interface PartidaCotizacionDTO {
  platilloId: number;
  nombrePlatillo: string;
  precioUnitario: string;
  cantidad: number;
  subtotalBruto: string;
  descuento: string;
  subtotalNeto: string;
  unidadesCobradas: number;
  unidadesBonificadas: number;
  promocionAplicadaId: number | null;
}

export interface PromocionAplicadaSnapshotDTO {
  id: number;
  nombre: string;
  tipo: TipoPromocion;
  porcentaje: string | null;
  n: number | null;
  m: number | null;
  duracion: DuracionPromocion;
  ahorroTotal: string;
}

export interface ResultadoCotizacionDTO {
  subtotalBruto: string;
  descuentoTotal: string;
  total: string;
  promocionAplicada: PromocionAplicadaSnapshotDTO | null;
  partidas: PartidaCotizacionDTO[];
  fechaEvaluacion: string;
}

export class PromocionesService {
  /**
   * Determina si una promoción está vigente a una fecha/hora específica (UTC del servidor).
   * Criterio CW-10:
   * - PERMANENTE: no vence mientras esté ACTIVA.
   * - TEMPORAL: inicio inclusivo, fin exclusivo (inicio <= fecha < fin).
   */
  static estaVigente(
    promo: {
      estado: EstadoPromocion;
      duracion: DuracionPromocion;
      fechaInicio: Date | string | null;
      fechaFin: Date | string | null;
    },
    fecha: Date = new Date()
  ): boolean {
    if (promo.estado !== 'ACTIVA') {
      return false;
    }

    if (promo.duracion === 'PERMANENTE') {
      return true;
    }

    if (!promo.fechaInicio || !promo.fechaFin) {
      return false;
    }

    const t = fecha.getTime();
    const ini = new Date(promo.fechaInicio).getTime();
    const fin = new Date(promo.fechaFin).getTime();

    // Inicio inclusivo, fin exclusivo (CW-10)
    return t >= ini && t < fin;
  }

  /**
   * Valida estrictamente las reglas de negocio de los parámetros de promoción.
   */
  static validarParametros(input: CrearPromocionInput | ActualizarPromocionInput) {
    if (input.nombre !== undefined) {
      if (!input.nombre || input.nombre.trim().length === 0) {
        throw new ErrorPromocion('PARAMETROS_INVALIDOS', 'El nombre de la promoción es obligatorio.');
      }
      if (input.nombre.trim().length > 100) {
        throw new ErrorPromocion('PARAMETROS_INVALIDOS', 'El nombre no puede exceder 100 caracteres.');
      }
    }

    if (input.platilloId !== undefined) {
      if (!Number.isInteger(input.platilloId) || input.platilloId <= 0) {
        throw new ErrorPromocion('PARAMETROS_INVALIDOS', 'El platilloId debe ser un entero positivo.');
      }
    }

    if (input.tipo !== undefined) {
      if (input.tipo !== 'PORCENTAJE' && input.tipo !== 'NXM') {
        throw new ErrorPromocion('TIPO_PROMOCION_INVALIDO', "El tipo debe ser 'PORCENTAJE' o 'NXM'.");
      }
    }

    // Validación según tipo
    if (input.tipo === 'PORCENTAJE') {
      if (input.porcentaje === undefined || input.porcentaje === null || input.porcentaje === '') {
        throw new ErrorPromocion('PORCENTAJE_INVALIDO', 'El valor de porcentaje es obligatorio para tipo PORCENTAJE.');
      }
      let decPorcentaje: Decimal;
      try {
        decPorcentaje = new Decimal(input.porcentaje);
      } catch {
        throw new ErrorPromocion('PORCENTAJE_INVALIDO', 'El porcentaje debe ser un número válido.');
      }

      if (decPorcentaje.lte(0) || decPorcentaje.gt(100)) {
        throw new ErrorPromocion('PORCENTAJE_INVALIDO', 'El porcentaje debe ser mayor a 0 y menor o igual a 100 (criterio CW-11).');
      }

      if (decPorcentaje.decimalPlaces() > 2) {
        throw new ErrorPromocion('PORCENTAJE_INVALIDO', 'El porcentaje no puede tener más de 2 decimales.');
      }

      if (input.n !== undefined && input.n !== null) {
        throw new ErrorPromocion('PARAMETROS_INVALIDOS', 'Una promoción de porcentaje no debe definir N.');
      }
      if (input.m !== undefined && input.m !== null) {
        throw new ErrorPromocion('PARAMETROS_INVALIDOS', 'Una promoción de porcentaje no debe definir M.');
      }
    } else if (input.tipo === 'NXM') {
      if (input.n === undefined || input.n === null || input.m === undefined || input.m === null) {
        throw new ErrorPromocion('NXM_INVALIDO', 'Los valores N y M son obligatorios para tipo NXM.');
      }

      if (!Number.isInteger(input.n) || !Number.isInteger(input.m)) {
        throw new ErrorPromocion('NXM_INVALIDO', 'N y M deben ser números enteros.');
      }

      if (input.m < 1) {
        throw new ErrorPromocion('NXM_INVALIDO', 'M debe ser al menos 1.');
      }

      if (input.n <= input.m) {
        throw new ErrorPromocion('NXM_INVALIDO', 'N debe ser estrictamente mayor que M (ejemplo: 2x1, 3x1, 3x2).');
      }

      if (input.porcentaje !== undefined && input.porcentaje !== null && input.porcentaje !== '') {
        throw new ErrorPromocion('PARAMETROS_INVALIDOS', 'Una promoción NXM no debe definir porcentaje.');
      }
    }

    // Validación según duración
    if (input.duracion !== undefined) {
      if (input.duracion !== 'TEMPORAL' && input.duracion !== 'PERMANENTE') {
        throw new ErrorPromocion('DURACION_INVALIDA', "La duración debe ser 'TEMPORAL' o 'PERMANENTE'.");
      }

      if (input.duracion === 'TEMPORAL') {
        if (!input.fechaInicio || !input.fechaFin) {
          throw new ErrorPromocion('VIGENCIA_INVALIDA', 'Las promociones temporales requieren fecha de inicio y fin.');
        }

        const ini = new Date(input.fechaInicio);
        const fin = new Date(input.fechaFin);

        if (isNaN(ini.getTime()) || isNaN(fin.getTime())) {
          throw new ErrorPromocion('VIGENCIA_INVALIDA', 'Las fechas deben ser instantes válidos en formato ISO 8601.');
        }

        if (ini.getTime() >= fin.getTime()) {
          throw new ErrorPromocion('VIGENCIA_INVALIDA', 'La fecha de inicio debe ser anterior a la fecha de fin.');
        }
      } else if (input.duracion === 'PERMANENTE') {
        if (input.fechaInicio || input.fechaFin) {
          throw new ErrorPromocion('PARAMETROS_INVALIDOS', 'Las promociones permanentes no deben incluir fechas de vigencia.');
        }
      }
    }
  }

  /**
   * Verifica que el platillo exista y se encuentre activo.
   */
  private static async obtenerPlatilloValidado(
    platilloId: number,
    clienteDb?: PoolClient | Pool
  ): Promise<{ id: number; nombre: string; precio: Decimal; activo: boolean }> {
    if (process.env.DATABASE_URL) {
      const db = clienteDb || pool;
      const res = await db.query('SELECT id, nombre, precio, activo FROM platillos WHERE id = $1', [platilloId]);
      if (res.rows.length === 0) {
        throw new ErrorPromocion('PLATILLO_NO_ENCONTRADO', `El platillo con ID ${platilloId} no existe.`, 404);
      }
      const p = res.rows[0];
      if (!p.activo) {
        throw new ErrorPromocion('PLATILLO_INACTIVO', `El platillo '${p.nombre}' está inactivo y no puede tener promociones.`, 400);
      }
      return { id: p.id, nombre: p.nombre, precio: new Decimal(p.precio), activo: p.activo };
    } else {
      const p = almacenMemoria.platillos.find((item) => item.id === platilloId);
      if (!p) {
        throw new ErrorPromocion('PLATILLO_NO_ENCONTRADO', `El platillo con ID ${platilloId} no existe.`, 404);
      }
      if (!p.activo) {
        throw new ErrorPromocion('PLATILLO_INACTIVO', `El platillo '${p.nombre}' está inactivo y no puede tener promociones.`, 400);
      }
      return { id: p.id, nombre: p.nombre, precio: p.precio, activo: p.activo };
    }
  }

  /**
   * Crea una nueva promoción en la base de datos o en memoria.
   */
  static async crearPromocion(
    input: CrearPromocionInput,
    usuarioId: number,
    clienteDb?: PoolClient | Pool
  ): Promise<PromocionDTO> {
    this.validarParametros(input);
    const platillo = await this.obtenerPlatilloValidado(input.platilloId, clienteDb);

    const ahora = new Date();
    const porcentajeDec = input.tipo === 'PORCENTAJE' ? new Decimal(input.porcentaje!) : null;
    const nInt = input.tipo === 'NXM' ? Number(input.n) : null;
    const mInt = input.tipo === 'NXM' ? Number(input.m) : null;
    const iniDate = input.duracion === 'TEMPORAL' ? new Date(input.fechaInicio!) : null;
    const finDate = input.duracion === 'TEMPORAL' ? new Date(input.fechaFin!) : null;

    if (process.env.DATABASE_URL) {
      const db = clienteDb || pool;
      const sql = `
        INSERT INTO promociones (
          nombre, platillo_id, tipo, porcentaje, n, m, duracion, fecha_inicio, fecha_fin, estado, usuario_id, creado_en, actualizado_en
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVA', $10, $11, $11)
        RETURNING *
      `;
      const res = await db.query(sql, [
        input.nombre.trim(),
        platillo.id,
        input.tipo,
        porcentajeDec ? porcentajeDec.toFixed(2) : null,
        nInt,
        mInt,
        input.duracion,
        iniDate,
        finDate,
        usuarioId,
        ahora
      ]);
      const row = res.rows[0];
      return this.mapearFilaADTO(row, platillo.nombre, platillo.precio.toFixed(2), ahora);
    } else {
      const id = almacenMemoria.proxPromocionId++;
      const nueva: PromocionInterna = {
        id,
        nombre: input.nombre.trim(),
        platilloId: platillo.id,
        tipo: input.tipo,
        porcentaje: porcentajeDec,
        n: nInt,
        m: mInt,
        duracion: input.duracion,
        fechaInicio: iniDate,
        fechaFin: finDate,
        estado: 'ACTIVA',
        usuarioId,
        creadoEn: ahora,
        actualizadoEn: ahora
      };
      almacenMemoria.promociones.push(nueva);
      return this.mapearInternoADTO(nueva, platillo.nombre, platillo.precio.toFixed(2), ahora);
    }
  }

  /**
   * Lista todas las promociones con cálculo dinámico de vigencia efectiva.
   */
  static async listarPromociones(
    soloActivas: boolean = false,
    clienteDb?: PoolClient | Pool
  ): Promise<PromocionDTO[]> {
    const ahora = new Date();

    if (process.env.DATABASE_URL) {
      const db = clienteDb || pool;
      let sql = `
        SELECT 
          pr.*,
          pl.nombre AS nombre_platillo,
          pl.precio AS precio_platillo
        FROM promociones pr
        JOIN platillos pl ON pr.platillo_id = pl.id
      `;
      const params: any[] = [];
      if (soloActivas) {
        sql += ` WHERE pr.estado = 'ACTIVA'`;
      }
      sql += ` ORDER BY pr.id ASC`;

      const res = await db.query(sql, params);
      return res.rows.map((r) => this.mapearFilaADTO(r, r.nombre_platillo, new Decimal(r.precio_platillo).toFixed(2), ahora));
    } else {
      let lista = almacenMemoria.promociones;
      if (soloActivas) {
        lista = lista.filter((p) => p.estado === 'ACTIVA');
      }

      return lista.map((p) => {
        const platillo = almacenMemoria.platillos.find((item) => item.id === p.platilloId);
        const nomPlatillo = platillo ? platillo.nombre : 'Desconocido';
        const precPlatillo = platillo ? platillo.precio.toFixed(2) : '0.00';
        return this.mapearInternoADTO(p, nomPlatillo, precPlatillo, ahora);
      });
    }
  }

  /**
   * Obtiene una promoción por ID.
   */
  static async obtenerPorId(id: number, clienteDb?: PoolClient | Pool): Promise<PromocionDTO> {
    const ahora = new Date();

    if (process.env.DATABASE_URL) {
      const db = clienteDb || pool;
      const sql = `
        SELECT 
          pr.*,
          pl.nombre AS nombre_platillo,
          pl.precio AS precio_platillo
        FROM promociones pr
        JOIN platillos pl ON pr.platillo_id = pl.id
        WHERE pr.id = $1
      `;
      const res = await db.query(sql, [id]);
      if (res.rows.length === 0) {
        throw new ErrorPromocion('PROMOCION_NO_ENCONTRADA', `La promoción con ID ${id} no existe.`, 404);
      }
      const r = res.rows[0];
      return this.mapearFilaADTO(r, r.nombre_platillo, new Decimal(r.precio_platillo).toFixed(2), ahora);
    } else {
      const p = almacenMemoria.promociones.find((item) => item.id === id);
      if (!p) {
        throw new ErrorPromocion('PROMOCION_NO_ENCONTRADA', `La promoción con ID ${id} no existe.`, 404);
      }
      const platillo = almacenMemoria.platillos.find((item) => item.id === p.platilloId);
      const nomPlatillo = platillo ? platillo.nombre : 'Desconocido';
      const precPlatillo = platillo ? platillo.precio.toFixed(2) : '0.00';
      return this.mapearInternoADTO(p, nomPlatillo, precPlatillo, ahora);
    }
  }

  /**
   * Actualiza los datos de una promoción existente.
   * Regla de negocio: Una promoción RETIRADA es inmutable y no se puede editar.
   * Limpia parámetros que dejan de aplicar al cambiar de tipo o duración (CW-10).
   */
  static async actualizarPromocion(
    id: number,
    input: ActualizarPromocionInput,
    usuarioId: number,
    clienteDb?: PoolClient | Pool
  ): Promise<PromocionDTO> {
    const actual = await this.obtenerPorId(id, clienteDb);
    if (actual.estado === 'RETIRADA') {
      throw new ErrorPromocion('PROMOCION_RETIRADA', 'No se puede modificar una promoción en estado RETIRADA.', 409);
    }

    const tipoFinal = input.tipo !== undefined ? input.tipo : actual.tipo;
    const duracionFinal = input.duracion !== undefined ? input.duracion : actual.duracion;

    // Fusión limpia de parámetros: descartar valores que dejan de aplicar al cambiar de tipo o duración
    let porcentajeMerged: string | number | null | undefined = undefined;
    let nMerged: number | null | undefined = undefined;
    let mMerged: number | null | undefined = undefined;

    if (tipoFinal === 'PORCENTAJE') {
      porcentajeMerged = input.porcentaje !== undefined ? input.porcentaje : actual.porcentaje;
      nMerged = input.n !== undefined && input.n !== null ? input.n : undefined;
      mMerged = input.m !== undefined && input.m !== null ? input.m : undefined;
    } else if (tipoFinal === 'NXM') {
      porcentajeMerged =
        input.porcentaje !== undefined && input.porcentaje !== null && input.porcentaje !== ''
          ? input.porcentaje
          : undefined;
      nMerged = input.n !== undefined ? input.n : actual.n;
      mMerged = input.m !== undefined ? input.m : actual.m;
    }

    let fechaInicioMerged: string | null | undefined = undefined;
    let fechaFinMerged: string | null | undefined = undefined;

    if (duracionFinal === 'PERMANENTE') {
      fechaInicioMerged =
        input.fechaInicio !== undefined && input.fechaInicio !== null && input.fechaInicio !== ''
          ? input.fechaInicio
          : undefined;
      fechaFinMerged =
        input.fechaFin !== undefined && input.fechaFin !== null && input.fechaFin !== ''
          ? input.fechaFin
          : undefined;
    } else if (duracionFinal === 'TEMPORAL') {
      fechaInicioMerged = input.fechaInicio !== undefined ? input.fechaInicio : actual.fechaInicio;
      fechaFinMerged = input.fechaFin !== undefined ? input.fechaFin : actual.fechaFin;
    }

    const mergedInput: CrearPromocionInput = {
      nombre: input.nombre !== undefined ? input.nombre : actual.nombre,
      platilloId: input.platilloId !== undefined ? input.platilloId : actual.platilloId,
      tipo: tipoFinal,
      porcentaje: porcentajeMerged,
      n: nMerged,
      m: mMerged,
      duracion: duracionFinal,
      fechaInicio: fechaInicioMerged,
      fechaFin: fechaFinMerged
    };

    this.validarParametros(mergedInput);
    const platillo = await this.obtenerPlatilloValidado(mergedInput.platilloId, clienteDb);

    const ahora = new Date();
    const porcentajeDec = tipoFinal === 'PORCENTAJE' ? new Decimal(mergedInput.porcentaje!) : null;
    const nInt = tipoFinal === 'NXM' ? Number(mergedInput.n) : null;
    const mInt = tipoFinal === 'NXM' ? Number(mergedInput.m) : null;
    const iniDate = duracionFinal === 'TEMPORAL' ? new Date(mergedInput.fechaInicio!) : null;
    const finDate = duracionFinal === 'TEMPORAL' ? new Date(mergedInput.fechaFin!) : null;
    const nuevoEstado = input.estado || actual.estado;

    if (process.env.DATABASE_URL) {
      const db = clienteDb || pool;
      const sql = `
        UPDATE promociones SET
          nombre = $1,
          platillo_id = $2,
          tipo = $3,
          porcentaje = $4,
          n = $5,
          m = $6,
          duracion = $7,
          fecha_inicio = $8,
          fecha_fin = $9,
          estado = $10,
          usuario_id = $11,
          actualizado_en = $12
        WHERE id = $13 AND estado <> 'RETIRADA'
        RETURNING *
      `;
      const res = await db.query(sql, [
        mergedInput.nombre.trim(),
        platillo.id,
        tipoFinal,
        porcentajeDec ? porcentajeDec.toFixed(2) : null,
        nInt,
        mInt,
        duracionFinal,
        iniDate,
        finDate,
        nuevoEstado,
        usuarioId,
        ahora,
        id
      ]);
      if (res.rowCount === 0) {
        const check = await db.query('SELECT estado FROM promociones WHERE id = $1', [id]);
        if (check.rowCount === 0) {
          throw new ErrorPromocion('PROMOCION_NO_ENCONTRADA', `La promoción con ID ${id} no existe.`, 404);
        }
        if (check.rows[0].estado === 'RETIRADA') {
          throw new ErrorPromocion('PROMOCION_RETIRADA', 'No se puede modificar una promoción en estado RETIRADA.', 409);
        }
        throw new ErrorPromocion('ERROR_CONCURRENCIA', 'No se pudo actualizar la promoción por conflicto concurrente.', 409);
      }
      const row = res.rows[0];
      return this.mapearFilaADTO(row, platillo.nombre, platillo.precio.toFixed(2), ahora);
    } else {
      const idx = almacenMemoria.promociones.findIndex((item) => item.id === id);
      if (idx === -1) {
        throw new ErrorPromocion('PROMOCION_NO_ENCONTRADA', `La promoción con ID ${id} no existe.`, 404);
      }
      if (almacenMemoria.promociones[idx].estado === 'RETIRADA') {
        throw new ErrorPromocion('PROMOCION_RETIRADA', 'No se puede modificar una promoción en estado RETIRADA.', 409);
      }
      const updated: PromocionInterna = {
        ...almacenMemoria.promociones[idx],
        nombre: mergedInput.nombre.trim(),
        platilloId: platillo.id,
        tipo: tipoFinal,
        porcentaje: porcentajeDec,
        n: nInt,
        m: mInt,
        duracion: duracionFinal,
        fechaInicio: iniDate,
        fechaFin: finDate,
        estado: nuevoEstado,
        usuarioId,
        actualizadoEn: ahora
      };
      almacenMemoria.promociones[idx] = updated;
      return this.mapearInternoADTO(updated, platillo.nombre, platillo.precio.toFixed(2), ahora);
    }
  }

  /**
   * Cambia el estado operativo de una promoción (ACTIVA / INACTIVA).
   * No permite reactivar una promoción RETIRADA bajo ninguna circunstancia.
   * Transición atómica con condición WHERE estado <> 'RETIRADA' (Criterio CW-10).
   */
  static async cambiarEstado(
    id: number,
    nuevoEstado: EstadoPromocion,
    usuarioId: number,
    clienteDb?: PoolClient | Pool
  ): Promise<PromocionDTO> {
    if (nuevoEstado !== 'ACTIVA' && nuevoEstado !== 'INACTIVA' && nuevoEstado !== 'RETIRADA') {
      throw new ErrorPromocion('ESTADO_INVALIDO', "El estado debe ser 'ACTIVA', 'INACTIVA' o 'RETIRADA'.");
    }

    const ahora = new Date();
    const db = clienteDb || pool;

    if (process.env.DATABASE_URL) {
      const res = await db.query(
        `UPDATE promociones SET estado = $1, usuario_id = $2, actualizado_en = $3 WHERE id = $4 AND estado <> 'RETIRADA' RETURNING *`,
        [nuevoEstado, usuarioId, ahora, id]
      );
      if (res.rowCount === 0) {
        const check = await db.query('SELECT estado FROM promociones WHERE id = $1', [id]);
        if (check.rowCount === 0) {
          throw new ErrorPromocion('PROMOCION_NO_ENCONTRADA', `La promoción con ID ${id} no existe.`, 404);
        }
        if (check.rows[0].estado === 'RETIRADA') {
          throw new ErrorPromocion('PROMOCION_RETIRADA', 'No se puede cambiar el estado de una promoción retirada.', 409);
        }
        throw new ErrorPromocion('ERROR_CONCURRENCIA', 'No se pudo actualizar el estado de la promoción por conflicto concurrente.', 409);
      }
      const row = res.rows[0];
      const platilloRes = await db.query('SELECT nombre, precio FROM platillos WHERE id = $1', [row.platillo_id]);
      const platillo = platilloRes.rows[0] || { nombre: 'Desconocido', precio: '0.00' };
      return this.mapearFilaADTO(row, platillo.nombre, new Decimal(platillo.precio).toFixed(2), ahora);
    } else {
      const idx = almacenMemoria.promociones.findIndex((p) => p.id === id);
      if (idx === -1) {
        throw new ErrorPromocion('PROMOCION_NO_ENCONTRADA', `La promoción con ID ${id} no existe.`, 404);
      }
      if (almacenMemoria.promociones[idx].estado === 'RETIRADA') {
        throw new ErrorPromocion('PROMOCION_RETIRADA', 'No se puede cambiar el estado de una promoción retirada.', 409);
      }

      almacenMemoria.promociones[idx].estado = nuevoEstado;
      almacenMemoria.promociones[idx].usuarioId = usuarioId;
      almacenMemoria.promociones[idx].actualizadoEn = ahora;

      const platillo = almacenMemoria.platillos.find((item) => item.id === almacenMemoria.promociones[idx].platilloId);
      const nomPlatillo = platillo ? platillo.nombre : 'Desconocido';
      const precPlatillo = platillo ? platillo.precio.toFixed(2) : '0.00';
      return this.mapearInternoADTO(almacenMemoria.promociones[idx], nomPlatillo, precPlatillo, ahora);
    }
  }

  /**
   * Retira definitivamente una promoción (baja lógica inmutable).
   */
  static async retirarPromocion(
    id: number,
    usuarioId: number,
    clienteDb?: PoolClient | Pool
  ): Promise<PromocionDTO> {
    return this.cambiarEstado(id, 'RETIRADA', usuarioId, clienteDb);
  }

  /**
   * MOTOR DE CÁLCULO EXACTO (W3-03 / W3-05)
   * Calcula el ahorro producido por una promoción sobre un platillo específico.
   * Reglas exactas:
   * - Porcentaje: round_half_up(q * precio * (p/100)).
   * - NxM: grupos = floor(q/N), bonificadas = grupos * (N - M), ahorro = bonificadas * precio.
   */
  static calcularAhorroDePromocion(
    promo: {
      tipo: TipoPromocion;
      porcentaje: Decimal | null;
      n: number | null;
      m: number | null;
    },
    precioPlatillo: Decimal,
    cantidad: number
  ): { ahorro: Decimal; unidadesCobradas: number; unidadesBonificadas: number } {
    if (cantidad <= 0) {
      return { ahorro: new Decimal(0), unidadesCobradas: 0, unidadesBonificadas: 0 };
    }

    if (promo.tipo === 'PORCENTAJE') {
      const subtotalBruto = precioPlatillo.times(cantidad);
      const porcentajeDec = promo.porcentaje || new Decimal(0);
      const ahorro = subtotalBruto.times(porcentajeDec).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      return {
        ahorro,
        unidadesCobradas: cantidad,
        unidadesBonificadas: 0
      };
    } else if (promo.tipo === 'NXM') {
      const n = promo.n!;
      const m = promo.m!;
      const q = cantidad;

      const grupos = Math.floor(q / n);
      const sobrantes = q % n;
      const unidadesCobradas = grupos * m + sobrantes;
      const unidadesBonificadas = q - unidadesCobradas; // o grupos * (n - m)

      const ahorro = precioPlatillo.times(unidadesBonificadas).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      return {
        ahorro,
        unidadesCobradas,
        unidadesBonificadas
      };
    }

    return { ahorro: new Decimal(0), unidadesCobradas: cantidad, unidadesBonificadas: 0 };
  }

  /**
   * EVALUACIÓN Y COTIZACIÓN DE ORDEN (W3-03 / W3-05)
   * Aplica la regla estricta de "Una sola promoción por orden":
   * 1. Evalúa todas las promociones activas y vigentes para los platillos de la orden.
   * 2. Selecciona la promoción que otorgue el MAYOR AHORRO monetario.
   * 3. Desempate determinista por MENOR ID (CW-13).
   * 4. Asigna el descuento a la partida participante; las demás quedan a precio íntegro.
   * 5. Suma de subtotales netos == total de la orden.
   */
  /**
   * EVALUACIÓN Y COTIZACIÓN DE ORDEN (W3-03 / W3-05)
   * Aplica la regla estricta de "Una sola promoción por orden":
   * 1. Evalúa todas las promociones activas y vigentes para los platillos de la orden.
   * 2. Selecciona la promoción que otorgue el MAYOR AHORRO monetario.
   * 3. Desempate determinista por MENOR ID (CW-13).
   * 4. Asigna el descuento a la partida participante; las demás quedan a precio íntegro.
   * 5. Suma de subtotales netos == total de la orden.
   * Soporta ejecución atómica bajo PoolClient con bloqueo determinista ordenado (CW-14).
   */
  static async cotizarOrden(
    items: ItemCotizacionInput[],
    fechaEvaluacion: Date = new Date(),
    clienteDb?: PoolClient | Pool,
    bloquearParaConfirmacion: boolean = false
  ): Promise<ResultadoCotizacionDTO> {
    if (!items || items.length === 0) {
      throw new ErrorPromocion('ORDEN_VACIA', 'La orden debe contener al menos un platillo.');
    }

    // Consolidar cantidades por platilloId en caso de que vengan partidas repetidas
    const itemsConsolidadosMap = new Map<number, number>();
    for (const it of items) {
      if (!Number.isInteger(it.platilloId) || it.platilloId <= 0) {
        throw new ErrorPromocion('PARAMETROS_INVALIDOS', 'El ID del platillo debe ser un entero positivo.');
      }
      if (!Number.isInteger(it.cantidad) || it.cantidad <= 0) {
        throw new ErrorPromocion('CANTIDAD_INVALIDA', `La cantidad para el platillo ${it.platilloId} debe ser un entero positivo.`);
      }
      const actual = itemsConsolidadosMap.get(it.platilloId) || 0;
      itemsConsolidadosMap.set(it.platilloId, actual + it.cantidad);
    }

    const idsPlatillos = Array.from(itemsConsolidadosMap.keys()).sort((a, b) => a - b);
    const platillosInfo = new Map<number, { id: number; nombre: string; precio: Decimal }>();
    let todasPromos: PromocionDTO[] = [];

    if (process.env.DATABASE_URL) {
      const db = clienteDb || pool;
      // Lectura atómica consistente de platillos con bloqueo opcional en orden determinista (CW-14)
      let sqlPlatillos = 'SELECT id, nombre, precio, activo FROM platillos WHERE id = ANY($1) ORDER BY id ASC';
      if (bloquearParaConfirmacion) {
        sqlPlatillos += ' FOR SHARE';
      }
      const resPlatillos = await db.query(sqlPlatillos, [idsPlatillos]);
      const platillosMap = new Map(resPlatillos.rows.map((r: any) => [r.id, r]));

      for (const pid of idsPlatillos) {
        const p = platillosMap.get(pid);
        if (!p) {
          throw new ErrorPromocion('PLATILLO_NO_ENCONTRADO', `El platillo con ID ${pid} no existe.`, 404);
        }
        if (!p.activo) {
          throw new ErrorPromocion('PLATILLO_INACTIVO', `El platillo '${p.nombre}' está inactivo y no puede venderse.`, 400);
        }
        platillosInfo.set(pid, { id: p.id, nombre: p.nombre, precio: new Decimal(p.precio) });
      }

      // Lectura atómica consistente de promociones participantes
      let sqlPromos = `
        SELECT 
          pr.*,
          pl.nombre AS nombre_platillo,
          pl.precio AS precio_platillo
        FROM promociones pr
        JOIN platillos pl ON pr.platillo_id = pl.id
        WHERE pr.platillo_id = ANY($1) AND pr.estado = 'ACTIVA'
        ORDER BY pr.id ASC
      `;
      if (bloquearParaConfirmacion) {
        sqlPromos += ' FOR SHARE OF pr';
      }
      const resPromos = await db.query(sqlPromos, [idsPlatillos]);
      todasPromos = resPromos.rows.map((r: any) =>
        this.mapearFilaADTO(r, r.nombre_platillo, new Decimal(r.precio_platillo).toFixed(2), fechaEvaluacion)
      );
    } else {
      for (const platilloId of idsPlatillos) {
        const p = await this.obtenerPlatilloValidado(platilloId);
        platillosInfo.set(platilloId, p);
      }
      const todas = await this.listarPromociones(true);
      todasPromos = todas.filter((p) => itemsConsolidadosMap.has(p.platilloId));
    }

    // Filtrar únicamente las que apliquen a los platillos de la orden y estén vigentes
    const promosElegibles = todasPromos.filter((p) => {
      if (!itemsConsolidadosMap.has(p.platilloId)) return false;
      return this.estaVigente(p, fechaEvaluacion);
    });

    // Evaluar ahorro potencial de cada promoción elegible
    let mejorPromo: {
      promo: PromocionDTO;
      ahorro: Decimal;
      unidadesCobradas: number;
      unidadesBonificadas: number;
    } | null = null;

    for (const promo of promosElegibles) {
      const platillo = platillosInfo.get(promo.platilloId)!;
      const cantidad = itemsConsolidadosMap.get(promo.platilloId)!;
      const res = this.calcularAhorroDePromocion(
        {
          tipo: promo.tipo,
          porcentaje: promo.porcentaje ? new Decimal(promo.porcentaje) : null,
          n: promo.n,
          m: promo.m
        },
        platillo.precio,
        cantidad
      );

      if (res.ahorro.gt(0)) {
        if (!mejorPromo) {
          mejorPromo = { promo, ahorro: res.ahorro, unidadesCobradas: res.unidadesCobradas, unidadesBonificadas: res.unidadesBonificadas };
        } else {
          // Comparar: mayor ahorro gana; empate por menor ID (CW-13)
          if (res.ahorro.gt(mejorPromo.ahorro)) {
            mejorPromo = { promo, ahorro: res.ahorro, unidadesCobradas: res.unidadesCobradas, unidadesBonificadas: res.unidadesBonificadas };
          } else if (res.ahorro.equals(mejorPromo.ahorro) && promo.id < mejorPromo.promo.id) {
            mejorPromo = { promo, ahorro: res.ahorro, unidadesCobradas: res.unidadesCobradas, unidadesBonificadas: res.unidadesBonificadas };
          }
        }
      }
    }

    // Construir desglose de partidas
    let subtotalBrutoAcumulado = new Decimal(0);
    let descuentoTotalAcumulado = new Decimal(0);
    const partidas: PartidaCotizacionDTO[] = [];

    for (const [platilloId, cantidad] of itemsConsolidadosMap.entries()) {
      const platillo = platillosInfo.get(platilloId)!;
      const subtotalBruto = platillo.precio.times(cantidad).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      subtotalBrutoAcumulado = subtotalBrutoAcumulado.plus(subtotalBruto);

      let descuentoPartida = new Decimal(0);
      let cobradas = cantidad;
      let bonificadas = 0;
      let promoIdAplicada: number | null = null;

      if (mejorPromo && mejorPromo.promo.platilloId === platilloId) {
        descuentoPartida = mejorPromo.ahorro;
        cobradas = mejorPromo.unidadesCobradas;
        bonificadas = mejorPromo.unidadesBonificadas;
        promoIdAplicada = mejorPromo.promo.id;
        descuentoTotalAcumulado = descuentoTotalAcumulado.plus(descuentoPartida);
      }

      const subtotalNeto = subtotalBruto.minus(descuentoPartida).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      partidas.push({
        platilloId: platillo.id,
        nombrePlatillo: platillo.nombre,
        precioUnitario: platillo.precio.toFixed(2),
        cantidad,
        subtotalBruto: subtotalBruto.toFixed(2),
        descuento: descuentoPartida.toFixed(2),
        subtotalNeto: subtotalNeto.toFixed(2),
        unidadesCobradas: cobradas,
        unidadesBonificadas: bonificadas,
        promocionAplicadaId: promoIdAplicada
      });
    }

    const totalNeto = subtotalBrutoAcumulado.minus(descuentoTotalAcumulado).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const totalFinal = totalNeto.lt(0) ? new Decimal(0) : totalNeto;

    const snapshotPromo: PromocionAplicadaSnapshotDTO | null = mejorPromo
      ? {
          id: mejorPromo.promo.id,
          nombre: mejorPromo.promo.nombre,
          tipo: mejorPromo.promo.tipo,
          porcentaje: mejorPromo.promo.porcentaje,
          n: mejorPromo.promo.n,
          m: mejorPromo.promo.m,
          duracion: mejorPromo.promo.duracion,
          ahorroTotal: mejorPromo.ahorro.toFixed(2)
        }
      : null;

    return {
      subtotalBruto: subtotalBrutoAcumulado.toFixed(2),
      descuentoTotal: descuentoTotalAcumulado.toFixed(2),
      total: totalFinal.toFixed(2),
      promocionAplicada: snapshotPromo,
      partidas,
      fechaEvaluacion: fechaEvaluacion.toISOString()
    };
  }

  /**
   * REVALIDACIÓN DE CONSISTENCIA PARA VENTAS (Criterio CW-14)
   * Compara una cotización previa con una reevaluación actual.
   * Valida la huella íntegra de la regla de promoción, partidas y precios.
   * Si cambiaron precios, vigencias, parámetros o promociones, arroja COTIZACION_DESACTUALIZADA con el nuevo resultado.
   * Admite opcionalmente un PoolClient para revalidación atómica dentro de la transacción de Ventas.
   */
  static async validarConsistenciaCotizacion(
    cotizacionPrevia: ResultadoCotizacionDTO,
    clienteDb?: PoolClient | Pool,
    bloquearParaConfirmacion: boolean = false
  ): Promise<ResultadoCotizacionDTO> {
    const items: ItemCotizacionInput[] = cotizacionPrevia.partidas.map((p) => ({
      platilloId: p.platilloId,
      cantidad: p.cantidad
    }));

    const cotizacionActual = await this.cotizarOrden(
      items,
      new Date(),
      clienteDb,
      bloquearParaConfirmacion
    );

    // 1. Huella íntegra de la regla aplicada (Finding 2 / CW-14)
    // Compara versión o huella de la regla: ID, nombre, tipo, porcentaje, n, m, duración y ahorro
    const prevPromo = cotizacionPrevia.promocionAplicada;
    const actPromo = cotizacionActual.promocionAplicada;

    const huellaPromoPrev = prevPromo
      ? `${prevPromo.id}|${prevPromo.nombre}|${prevPromo.tipo}|${prevPromo.porcentaje ?? ''}|${prevPromo.n ?? ''}|${prevPromo.m ?? ''}|${prevPromo.duracion}|${prevPromo.ahorroTotal}`
      : 'SIN_PROMO';

    const huellaPromoAct = actPromo
      ? `${actPromo.id}|${actPromo.nombre}|${actPromo.tipo}|${actPromo.porcentaje ?? ''}|${actPromo.n ?? ''}|${actPromo.m ?? ''}|${actPromo.duracion}|${actPromo.ahorroTotal}`
      : 'SIN_PROMO';

    const cambioReglaPromo = huellaPromoPrev !== huellaPromoAct;

    // 2. Comprobación exhaustiva de cada partida (precios, cantidades, descuentos, cobradas y bonificadas)
    const cambioPartidas =
      cotizacionPrevia.partidas.length !== cotizacionActual.partidas.length ||
      cotizacionPrevia.partidas.some((pPrevia) => {
        const pActual = cotizacionActual.partidas.find((item) => item.platilloId === pPrevia.platilloId);
        if (!pActual) return true;
        return (
          pActual.precioUnitario !== pPrevia.precioUnitario ||
          pActual.cantidad !== pPrevia.cantidad ||
          pActual.subtotalBruto !== pPrevia.subtotalBruto ||
          pActual.descuento !== pPrevia.descuento ||
          pActual.subtotalNeto !== pPrevia.subtotalNeto ||
          pActual.unidadesCobradas !== pPrevia.unidadesCobradas ||
          pActual.unidadesBonificadas !== pPrevia.unidadesBonificadas ||
          pActual.promocionAplicadaId !== pPrevia.promocionAplicadaId
        );
      });

    // 3. Comprobación de totales monetarios
    const cambioTotales =
      cotizacionPrevia.total !== cotizacionActual.total ||
      cotizacionPrevia.subtotalBruto !== cotizacionActual.subtotalBruto ||
      cotizacionPrevia.descuentoTotal !== cotizacionActual.descuentoTotal;

    if (cambioReglaPromo || cambioPartidas || cambioTotales) {
      throw new ErrorPromocion(
        'COTIZACION_DESACTUALIZADA',
        'Los precios o las condiciones de las promociones han cambiado. Por favor acepte el nuevo resumen.',
        409,
        {
          cotizacionPrevia,
          nuevaCotizacion: cotizacionActual
        }
      );
    }

    return cotizacionActual;
  }

  // ==========================================
  // HELPERS DE MAPEO
  // ==========================================

  private static mapearFilaADTO(row: any, nombrePlatillo: string, precioPlatillo: string, ahora: Date): PromocionDTO {
    const duracion = row.duracion as DuracionPromocion;
    const estado = row.estado as EstadoPromocion;
    const ini = row.fecha_inicio ? new Date(row.fecha_inicio) : null;
    const fin = row.fecha_fin ? new Date(row.fecha_fin) : null;

    const vigente = this.estaVigente({ estado, duracion, fechaInicio: ini, fechaFin: fin }, ahora);

    return {
      id: Number(row.id),
      nombre: row.nombre,
      platilloId: Number(row.platillo_id),
      nombrePlatillo,
      precioPlatillo,
      tipo: row.tipo as TipoPromocion,
      porcentaje: row.porcentaje !== null ? new Decimal(row.porcentaje).toFixed(2) : null,
      n: row.n !== null ? Number(row.n) : null,
      m: row.m !== null ? Number(row.m) : null,
      duracion,
      fechaInicio: ini ? ini.toISOString() : null,
      fechaFin: fin ? fin.toISOString() : null,
      estado,
      vigente,
      usuarioId: Number(row.usuario_id),
      creadoEn: new Date(row.creado_en).toISOString(),
      actualizadoEn: new Date(row.actualizado_en).toISOString()
    };
  }

  private static mapearInternoADTO(p: PromocionInterna, nombrePlatillo: string, precioPlatillo: string, ahora: Date): PromocionDTO {
    const vigente = this.estaVigente(p, ahora);

    return {
      id: p.id,
      nombre: p.nombre,
      platilloId: p.platilloId,
      nombrePlatillo,
      precioPlatillo,
      tipo: p.tipo,
      porcentaje: p.porcentaje ? p.porcentaje.toFixed(2) : null,
      n: p.n,
      m: p.m,
      duracion: p.duracion,
      fechaInicio: p.fechaInicio ? p.fechaInicio.toISOString() : null,
      fechaFin: p.fechaFin ? p.fechaFin.toISOString() : null,
      estado: p.estado,
      vigente,
      usuarioId: p.usuarioId,
      creadoEn: p.creadoEn.toISOString(),
      actualizadoEn: p.actualizadoEn.toISOString()
    };
  }
}
