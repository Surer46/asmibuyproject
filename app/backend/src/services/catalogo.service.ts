import Decimal from 'decimal.js';
import { Pool, PoolClient } from 'pg';
import { pool } from '../config/database';
import { ejecutarTransaccion } from './db.service';
import { almacenMemoria } from './almacen-memoria';

export type UnidadIngrediente = 'g' | 'ml' | 'pieza';
export type EstadoStock = 'NORMAL' | 'BAJO_STOCK' | 'AGOTADO';

export interface IngredienteDTO {
  id: number;
  nombre: string;
  unidad: UnidadIngrediente;
  minimo: string;
  existencia: string;
  estadoStock: EstadoStock;
  activo: boolean;
}

export interface IngredienteRecetaDTO {
  ingredienteId: number;
  nombreIngrediente: string;
  unidad: UnidadIngrediente;
  cantidad: string;
}

export interface PlatilloDTO {
  id: number;
  nombre: string;
  precio: string;
  activo: boolean;
  recetaValida: boolean;
  ingredientes?: IngredienteRecetaDTO[];
}

export interface CrearIngredienteInput {
  nombre: string;
  unidad: UnidadIngrediente;
  minimo?: string | number;
}

export interface ActualizarIngredienteInput {
  nombre?: string;
  unidad?: UnidadIngrediente;
  minimo?: string | number;
  activo?: boolean;
}

export interface ItemRecetaInput {
  ingredienteId: number;
  cantidad: string | number;
}

export interface CrearPlatilloInput {
  nombre: string;
  precio: string | number;
  receta: ItemRecetaInput[];
}

export interface ActualizarPlatilloInput {
  nombre?: string;
  precio?: string | number;
  activo?: boolean;
  receta?: ItemRecetaInput[];
}

export class ErrorCatalogo extends Error {
  constructor(
    public codigo: string,
    mensaje: string,
    public statusCode: number = 400,
    public detalles: any = null
  ) {
    super(mensaje);
    this.name = 'ErrorCatalogo';
  }
}

/**
 * Validador estricto para números decimales finitos y con formato admitido.
 * Rechaza valores no finitos (NaN, Infinity, -Infinity), cadenas no numéricas,
 * notación científica o violaciones de escala y límites.
 */
export function validarNumeroDecimal(
  valor: any,
  campo: string,
  opciones: {
    min?: Decimal.Value;
    max?: Decimal.Value;
    escalaMax?: number;
    entero?: boolean;
    positivo?: boolean;
    noNegativo?: boolean;
    permitirSignoExplicito?: boolean;
    codigoError?: string;
  } = {}
): Decimal {
  const codigo = opciones.codigoError || 'DATOS_INVALIDOS';

  if (valor === null || valor === undefined || typeof valor === 'boolean') {
    throw new ErrorCatalogo(codigo, `El campo "${campo}" es requerido y no puede ser nulo.`);
  }

  const str = String(valor).trim();
  if (!str) {
    throw new ErrorCatalogo(codigo, `El campo "${campo}" no puede estar vacío.`);
  }

  // Rechazo explícito de NaN, Infinity y cadenas con formato no numérico o notación científica
  const regex = opciones.permitirSignoExplicito ? /^[+-]?\d+(\.\d+)?$/ : /^-?\d+(\.\d+)?$/;
  if (!regex.test(str)) {
    throw new ErrorCatalogo(codigo, `El campo "${campo}" debe ser un número decimal finito válido (recibido: "${str}").`);
  }

  let dec: Decimal;
  try {
    dec = new Decimal(str);
  } catch {
    throw new ErrorCatalogo(codigo, `El campo "${campo}" contiene un valor numérico inválido.`);
  }

  if (dec.isNaN() || !dec.isFinite()) {
    throw new ErrorCatalogo(codigo, `El campo "${campo}" debe ser un número finito.`);
  }

  if (opciones.noNegativo && dec.lt(0)) {
    throw new ErrorCatalogo(codigo, `La ${campo} no puede ser negativa.`);
  }

  if (opciones.positivo && !dec.gt(0)) {
    throw new ErrorCatalogo(codigo, `El campo "${campo}" debe ser un importe positivo mayor a cero.`);
  }

  if (opciones.entero && !dec.mod(1).equals(0)) {
    throw new ErrorCatalogo(codigo, `La ${campo} para unidades tipo 'pieza' debe ser un número entero.`);
  }

  if (opciones.escalaMax !== undefined && dec.decimalPlaces() > opciones.escalaMax) {
    throw new ErrorCatalogo(
      codigo,
      `La ${campo} no puede tener más de ${opciones.escalaMax} decimales.`
    );
  }

  if (opciones.min !== undefined && dec.lt(opciones.min)) {
    throw new ErrorCatalogo(codigo, `El campo "${campo}" no puede ser menor a ${opciones.min}.`);
  }

  const maxLimite = opciones.max !== undefined ? new Decimal(opciones.max) : new Decimal('9999999.999');
  if (dec.abs().gt(maxLimite)) {
    throw new ErrorCatalogo(codigo, `El campo "${campo}" excede el límite máximo permitido (${maxLimite.toString()}).`);
  }

  return dec;
}

const ingredientesMemoria = almacenMemoria.ingredientes;
const platillosMemoria = almacenMemoria.platillos;
const movimientosMemoria = almacenMemoria.movimientos;

export class CatalogoService {
  /**
   * Valida la precisión y restricciones de una cantidad según la unidad del ingrediente
   */
  static validarCantidadPorUnidad(cantidad: Decimal | string | number, unidad: UnidadIngrediente, campo: string): Decimal {
    const escalaMax = unidad === 'pieza' ? 0 : 3;
    const entero = unidad === 'pieza';
    return validarNumeroDecimal(cantidad, campo, {
      noNegativo: true,
      entero,
      escalaMax,
      codigoError: 'CANTIDAD_INVALIDA'
    });
  }

  /**
   * Lista todos los ingredientes con su existencia actual calculada y su estado de stock
   */
  static async listarIngredientes(): Promise<IngredienteDTO[]> {
    if (process.env.DATABASE_URL) {
      // Consulta directa a PostgreSQL. Sin fallback a memoria ante caída de BD.
      const query = `
        SELECT 
          i.id,
          i.nombre,
          i.unidad,
          i.minimo,
          i.activo,
          COALESCE(SUM(m.cantidad), 0) AS existencia
        FROM ingredientes i
        LEFT JOIN movimientos_inventario m ON i.id = m.ingrediente_id
        GROUP BY i.id, i.nombre, i.unidad, i.minimo, i.activo
        ORDER BY i.nombre ASC;
      `;
      const { rows } = await pool.query(query);

      return rows.map((row) => {
        const existenciaDec = new Decimal(row.existencia);
        const minimoDec = new Decimal(row.minimo);

        let estadoStock: EstadoStock = 'NORMAL';
        if (existenciaDec.lte(0)) {
          estadoStock = 'AGOTADO';
        } else if (existenciaDec.lte(minimoDec)) {
          estadoStock = 'BAJO_STOCK';
        }

        return {
          id: row.id,
          nombre: row.nombre,
          unidad: row.unidad as UnidadIngrediente,
          minimo: row.unidad === 'pieza' ? minimoDec.toFixed(0) : minimoDec.toFixed(3),
          existencia: row.unidad === 'pieza' ? existenciaDec.toFixed(0) : existenciaDec.toFixed(3),
          estadoStock,
          activo: row.activo
        };
      });
    }

    // Almacén aislado exclusivo para pruebas unitarias sin BD
    return ingredientesMemoria
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((ing) => {
        const existencias = movimientosMemoria
          .filter((m) => m.ingredienteId === ing.id)
          .reduce((acc, m) => acc.plus(m.cantidad), new Decimal(0));

        let estadoStock: EstadoStock = 'NORMAL';
        if (existencias.lte(0)) {
          estadoStock = 'AGOTADO';
        } else if (existencias.lte(ing.minimo)) {
          estadoStock = 'BAJO_STOCK';
        }

        return {
          id: ing.id,
          nombre: ing.nombre,
          unidad: ing.unidad,
          minimo: ing.unidad === 'pieza' ? ing.minimo.toFixed(0) : ing.minimo.toFixed(3),
          existencia: ing.unidad === 'pieza' ? existencias.toFixed(0) : existencias.toFixed(3),
          estadoStock,
          activo: ing.activo
        };
      });
  }

  /**
   * Obtiene un ingrediente por su identificador.
   * Permite pasar un PoolClient transaccional para lecturas consistentes no confirmadas.
   */
  static async obtenerIngredientePorId(id: number, clienteDb?: PoolClient | Pool): Promise<IngredienteDTO | null> {
    if (process.env.DATABASE_URL) {
      const db = clienteDb || pool;
      const query = `
        SELECT 
          i.id,
          i.nombre,
          i.unidad,
          i.minimo,
          i.activo,
          COALESCE(SUM(m.cantidad), 0) AS existencia
        FROM ingredientes i
        LEFT JOIN movimientos_inventario m ON i.id = m.ingrediente_id
        WHERE i.id = $1
        GROUP BY i.id, i.nombre, i.unidad, i.minimo, i.activo;
      `;
      const { rows } = await db.query(query, [id]);
      if (rows.length > 0) {
        const row = rows[0];
        const existenciaDec = new Decimal(row.existencia);
        const minimoDec = new Decimal(row.minimo);

        let estadoStock: EstadoStock = 'NORMAL';
        if (existenciaDec.lte(0)) {
          estadoStock = 'AGOTADO';
        } else if (existenciaDec.lte(minimoDec)) {
          estadoStock = 'BAJO_STOCK';
        }

        return {
          id: row.id,
          nombre: row.nombre,
          unidad: row.unidad as UnidadIngrediente,
          minimo: row.unidad === 'pieza' ? minimoDec.toFixed(0) : minimoDec.toFixed(3),
          existencia: row.unidad === 'pieza' ? existenciaDec.toFixed(0) : existenciaDec.toFixed(3),
          estadoStock,
          activo: row.activo
        };
      }
      return null;
    }

    // Memoria aislada
    const ing = ingredientesMemoria.find((i) => i.id === id);
    if (!ing) return null;

    const existencias = movimientosMemoria
      .filter((m) => m.ingredienteId === ing.id)
      .reduce((acc, m) => acc.plus(m.cantidad), new Decimal(0));

    let estadoStock: EstadoStock = 'NORMAL';
    if (existencias.lte(0)) {
      estadoStock = 'AGOTADO';
    } else if (existencias.lte(ing.minimo)) {
      estadoStock = 'BAJO_STOCK';
    }

    return {
      id: ing.id,
      nombre: ing.nombre,
      unidad: ing.unidad,
      minimo: ing.unidad === 'pieza' ? ing.minimo.toFixed(0) : ing.minimo.toFixed(3),
      existencia: ing.unidad === 'pieza' ? existencias.toFixed(0) : existencias.toFixed(3),
      estadoStock,
      activo: ing.activo
    };
  }

  /**
   * Crea un nuevo ingrediente con su mínimo inicial obligatorio
   */
  static async crearIngrediente(input: CrearIngredienteInput): Promise<IngredienteDTO> {
    const nombre = input.nombre?.trim();
    if (!nombre) {
      throw new ErrorCatalogo('DATOS_INVALIDOS', 'El nombre del ingrediente es obligatorio.');
    }

    const unidadesValidas: UnidadIngrediente[] = ['g', 'ml', 'pieza'];
    if (!unidadesValidas.includes(input.unidad)) {
      throw new ErrorCatalogo('DATOS_INVALIDOS', "La unidad debe ser 'g', 'ml' o 'pieza'.");
    }

    const minimoValor = input.minimo !== undefined ? input.minimo : 0;
    const minimoDec = this.validarCantidadPorUnidad(minimoValor, input.unidad, 'cantidad mínima');

    if (process.env.DATABASE_URL) {
      try {
        const query = `
          INSERT INTO ingredientes (nombre, unidad, minimo, activo)
          VALUES ($1, $2, $3, TRUE)
          RETURNING id, nombre, unidad, minimo, activo;
        `;
        const { rows } = await pool.query(query, [nombre, input.unidad, minimoDec.toString()]);
        const nuevo = rows[0];

        return {
          id: nuevo.id,
          nombre: nuevo.nombre,
          unidad: nuevo.unidad,
          minimo: nuevo.unidad === 'pieza' ? minimoDec.toFixed(0) : minimoDec.toFixed(3),
          existencia: '0',
          estadoStock: 'AGOTADO',
          activo: nuevo.activo
        };
      } catch (error: any) {
        if (error.code === '23505') {
          throw new ErrorCatalogo('DATOS_INVALIDOS', `Ya existe un ingrediente registrado con el nombre "${nombre}".`);
        }
        throw error;
      }
    }

    // Memoria aislada
    if (ingredientesMemoria.some((i) => i.nombre.toLowerCase() === nombre.toLowerCase())) {
      throw new ErrorCatalogo('DATOS_INVALIDOS', `Ya existe un ingrediente registrado con el nombre "${nombre}".`);
    }

    const nuevoIng = {
      id: almacenMemoria.proxIngredienteId++,
      nombre,
      unidad: input.unidad,
      minimo: minimoDec,
      activo: true
    };
    ingredientesMemoria.push(nuevoIng);

    return {
      id: nuevoIng.id,
      nombre: nuevoIng.nombre,
      unidad: nuevoIng.unidad,
      minimo: nuevoIng.unidad === 'pieza' ? minimoDec.toFixed(0) : minimoDec.toFixed(3),
      existencia: '0',
      estadoStock: 'AGOTADO',
      activo: nuevoIng.activo
    };
  }

  /**
   * Actualiza un ingrediente respetando la inmutabilidad de la unidad si tiene historial
   */
  static async actualizarIngrediente(id: number, input: ActualizarIngredienteInput): Promise<IngredienteDTO> {
    const actual = await this.obtenerIngredientePorId(id);
    if (!actual) {
      throw new ErrorCatalogo('RECURSO_NO_ENCONTRADO', 'El ingrediente no existe.', 404);
    }

    let nuevoNombre = input.nombre !== undefined ? input.nombre.trim() : actual.nombre;
    if (!nuevoNombre) {
      throw new ErrorCatalogo('DATOS_INVALIDOS', 'El nombre del ingrediente no puede estar vacío.');
    }

    let nuevaUnidad = input.unidad !== undefined ? input.unidad : actual.unidad;
    const unidadesValidas: UnidadIngrediente[] = ['g', 'ml', 'pieza'];
    if (!unidadesValidas.includes(nuevaUnidad)) {
      throw new ErrorCatalogo('DATOS_INVALIDOS', "La unidad debe ser 'g', 'ml' o 'pieza'.");
    }

    // Regla de inmutabilidad de la unidad
    if (nuevaUnidad !== actual.unidad) {
      if (process.env.DATABASE_URL) {
        const referenciasRecetas = await pool.query('SELECT COUNT(*) FROM receta_detalle WHERE ingrediente_id = $1', [id]);
        const referenciasMovimientos = await pool.query('SELECT COUNT(*) FROM movimientos_inventario WHERE ingrediente_id = $1', [id]);
        const totalReferencias = parseInt(referenciasRecetas.rows[0].count, 10) + parseInt(referenciasMovimientos.rows[0].count, 10);
        if (totalReferencias > 0) {
          throw new ErrorCatalogo(
            'UNIDAD_INMUTABLE',
            'No se puede cambiar la unidad de un ingrediente que ya está referenciado en recetas o movimientos de inventario.'
          );
        }
      } else {
        // Validación en memoria
        const tieneRecetas = almacenMemoria.recetas.some((r) => r.ingredienteId === id);
        const tieneMovimientos = movimientosMemoria.some((m) => m.ingredienteId === id);
        if (tieneRecetas || tieneMovimientos) {
          throw new ErrorCatalogo(
            'UNIDAD_INMUTABLE',
            'No se puede cambiar la unidad de un ingrediente que ya está referenciado en recetas o movimientos de inventario.'
          );
        }
      }
    }

    let nuevoMinimoDec: Decimal;
    if (input.minimo !== undefined) {
      nuevoMinimoDec = this.validarCantidadPorUnidad(input.minimo, nuevaUnidad, 'cantidad mínima');
    } else {
      nuevoMinimoDec = this.validarCantidadPorUnidad(actual.minimo, nuevaUnidad, 'cantidad mínima');
    }

    let nuevoActivo = input.activo !== undefined ? input.activo : actual.activo;

    // Si se intenta desactivar el ingrediente, verificar si platillos activos lo usan
    if (actual.activo && nuevoActivo === false) {
      if (process.env.DATABASE_URL) {
        const platillosUso = await pool.query(
          `SELECT p.nombre 
           FROM platillos p 
           JOIN receta_detalle r ON p.id = r.platillo_id 
           WHERE r.ingrediente_id = $1 AND p.activo = TRUE`,
          [id]
        );
        if (platillosUso.rows.length > 0) {
          const nombres = platillosUso.rows.map((r) => `"${r.nombre}"`).join(', ');
          throw new ErrorCatalogo(
            'INGREDIENTE_EN_USO',
            `No se puede desactivar el ingrediente porque se usa en los siguientes platillos activos: ${nombres}. Desactiva o actualiza primero los platillos.`
          );
        }
      } else {
        // Validación en memoria
        const platillosActivosConIng = almacenMemoria.recetas
          .filter((r) => r.ingredienteId === id)
          .map((r) => platillosMemoria.find((p) => p.id === r.platilloId))
          .filter((p) => p && p.activo);

        if (platillosActivosConIng.length > 0) {
          const nombres = platillosActivosConIng.map((p) => `"${p!.nombre}"`).join(', ');
          throw new ErrorCatalogo(
            'INGREDIENTE_EN_USO',
            `No se puede desactivar el ingrediente porque se usa en los siguientes platillos activos: ${nombres}. Desactiva o actualiza primero los platillos.`
          );
        }
      }
    }

    if (process.env.DATABASE_URL) {
      try {
        const updateQuery = `
          UPDATE ingredientes
          SET nombre = $1, unidad = $2, minimo = $3, activo = $4, actualizado_en = CURRENT_TIMESTAMP
          WHERE id = $5
          RETURNING id, nombre, unidad, minimo, activo;
        `;
        await pool.query(updateQuery, [nuevoNombre, nuevaUnidad, nuevoMinimoDec.toString(), nuevoActivo, id]);
        return (await this.obtenerIngredientePorId(id))!;
      } catch (error: any) {
        if (error.code === '23505') {
          throw new ErrorCatalogo('DATOS_INVALIDOS', `Ya existe un ingrediente registrado con el nombre "${nuevoNombre}".`);
        }
        throw error;
      }
    }

    // Memoria aislada
    const index = ingredientesMemoria.findIndex((i) => i.id === id);
    if (index !== -1) {
      if (ingredientesMemoria.some((i) => i.id !== id && i.nombre.toLowerCase() === nuevoNombre.toLowerCase())) {
        throw new ErrorCatalogo('DATOS_INVALIDOS', `Ya existe un ingrediente registrado con el nombre "${nuevoNombre}".`);
      }
      ingredientesMemoria[index].nombre = nuevoNombre;
      ingredientesMemoria[index].unidad = nuevaUnidad;
      ingredientesMemoria[index].minimo = nuevoMinimoDec;
      ingredientesMemoria[index].activo = nuevoActivo;
    }

    return (await this.obtenerIngredientePorId(id))!;
  }

  /**
   * Consulta pública de platillos para venta y promociones (sólo activos y con recetas válidas)
   */
  static async listarPlatillosPublicos(): Promise<PlatilloDTO[]> {
    const todos = await this.listarPlatillosAdmin();
    return todos.filter((p) => p.activo && p.recetaValida);
  }

  /**
   * Consulta administrativa de todos los platillos con sus recetas
   */
  static async listarPlatillosAdmin(): Promise<PlatilloDTO[]> {
    if (process.env.DATABASE_URL) {
      const platillosQuery = `
        SELECT id, nombre, precio, activo
        FROM platillos
        ORDER BY nombre ASC;
      `;
      const { rows: platillosRows } = await pool.query(platillosQuery);

      const recetasQuery = `
        SELECT 
          r.platillo_id,
          r.ingrediente_id,
          i.nombre AS nombre_ingrediente,
          i.unidad,
          r.cantidad,
          i.activo AS ingrediente_activo
        FROM receta_detalle r
        JOIN ingredientes i ON r.ingrediente_id = i.id
        ORDER BY i.nombre ASC;
      `;
      const { rows: recetasRows } = await pool.query(recetasQuery);

      const recetasMap = new Map<number, Array<{
        ingredienteId: number;
        nombreIngrediente: string;
        unidad: UnidadIngrediente;
        cantidad: string;
        activo: boolean;
      }>>();

      for (const r of recetasRows) {
        if (!recetasMap.has(r.platillo_id)) {
          recetasMap.set(r.platillo_id, []);
        }
        const cantDec = new Decimal(r.cantidad);
        recetasMap.get(r.platillo_id)!.push({
          ingredienteId: r.ingrediente_id,
          nombreIngrediente: r.nombre_ingrediente,
          unidad: r.unidad as UnidadIngrediente,
          cantidad: r.unidad === 'pieza' ? cantDec.toFixed(0) : cantDec.toFixed(3),
          activo: r.ingrediente_activo
        });
      }

      return platillosRows.map((p) => {
        const ingredientes = recetasMap.get(p.id) || [];
        const tieneIngredientes = ingredientes.length > 0;
        const todosIngredientesActivos = tieneIngredientes && ingredientes.every((i) => i.activo);
        const recetaValida = tieneIngredientes && todosIngredientesActivos;

        return {
          id: p.id,
          nombre: p.nombre,
          precio: new Decimal(p.precio).toFixed(2),
          activo: p.activo,
          recetaValida,
          ingredientes: ingredientes.map(({ ingredienteId, nombreIngrediente, unidad, cantidad }) => ({
            ingredienteId,
            nombreIngrediente,
            unidad,
            cantidad
          }))
        };
      });
    }

    // Memoria aislada
    return platillosMemoria
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((p) => {
        const ingredientesReceta = almacenMemoria.recetas.filter((r) => r.platilloId === p.id);
        const tieneIngredientes = ingredientesReceta.length > 0;

        const ingredientesCompletos = ingredientesReceta.map((r) => {
          const ing = ingredientesMemoria.find((i) => i.id === r.ingredienteId);
          return {
            ingredienteId: r.ingredienteId,
            nombreIngrediente: ing ? ing.nombre : 'Desconocido',
            unidad: ing ? ing.unidad : 'pieza',
            cantidad: ing && ing.unidad === 'pieza' ? r.cantidad.toFixed(0) : r.cantidad.toFixed(3),
            activo: ing ? ing.activo : false
          };
        });

        const todosIngredientesActivos = tieneIngredientes && ingredientesCompletos.every((i) => i.activo);
        const recetaValida = tieneIngredientes && todosIngredientesActivos;

        return {
          id: p.id,
          nombre: p.nombre,
          precio: p.precio.toFixed(2),
          activo: p.activo,
          recetaValida,
          ingredientes: ingredientesCompletos.map(({ ingredienteId, nombreIngrediente, unidad, cantidad }) => ({
            ingredienteId,
            nombreIngrediente,
            unidad,
            cantidad
          }))
        };
      });
  }

  /**
   * Obtiene un platillo por su identificador.
   * Permite pasar un PoolClient transaccional para lecturas consistentes durante inserciones no confirmadas.
   */
  static async obtenerPlatilloPorId(id: number, clienteDb?: PoolClient | Pool): Promise<PlatilloDTO | null> {
    if (process.env.DATABASE_URL) {
      const db = clienteDb || pool;
      const query = `SELECT id, nombre, precio, activo FROM platillos WHERE id = $1;`;
      const { rows } = await db.query(query, [id]);
      if (rows.length > 0) {
        const platillo = rows[0];

        const recetasQuery = `
          SELECT 
            r.ingrediente_id,
            i.nombre AS nombre_ingrediente,
            i.unidad,
            r.cantidad,
            i.activo AS ingrediente_activo
          FROM receta_detalle r
          JOIN ingredientes i ON r.ingrediente_id = i.id
          WHERE r.platillo_id = $1
          ORDER BY i.nombre ASC;
        `;
        const { rows: recetasRows } = await db.query(recetasQuery, [id]);

        const tieneIngredientes = recetasRows.length > 0;
        const todosIngredientesActivos = tieneIngredientes && recetasRows.every((i) => i.ingrediente_activo);
        const recetaValida = tieneIngredientes && todosIngredientesActivos;

        return {
          id: platillo.id,
          nombre: platillo.nombre,
          precio: new Decimal(platillo.precio).toFixed(2),
          activo: platillo.activo,
          recetaValida,
          ingredientes: recetasRows.map((r) => {
            const cantDec = new Decimal(r.cantidad);
            return {
              ingredienteId: r.ingrediente_id,
              nombreIngrediente: r.nombre_ingrediente,
              unidad: r.unidad as UnidadIngrediente,
              cantidad: r.unidad === 'pieza' ? cantDec.toFixed(0) : cantDec.toFixed(3)
            };
          })
        };
      }
      return null;
    }

    // Memoria aislada
    const p = platillosMemoria.find((item) => item.id === id);
    if (!p) return null;

    const ingredientesReceta = almacenMemoria.recetas.filter((r) => r.platilloId === p.id);
    const tieneIngredientes = ingredientesReceta.length > 0;

    const ingredientesCompletos = ingredientesReceta.map((r) => {
      const ing = ingredientesMemoria.find((i) => i.id === r.ingredienteId);
      return {
        ingredienteId: r.ingredienteId,
        nombreIngrediente: ing ? ing.nombre : 'Desconocido',
        unidad: ing ? ing.unidad : 'pieza',
        cantidad: ing && ing.unidad === 'pieza' ? r.cantidad.toFixed(0) : r.cantidad.toFixed(3),
        activo: ing ? ing.activo : false
      };
    });

    const todosIngredientesActivos = tieneIngredientes && ingredientesCompletos.every((i) => i.activo);
    const recetaValida = tieneIngredientes && todosIngredientesActivos;

    return {
      id: p.id,
      nombre: p.nombre,
      precio: p.precio.toFixed(2),
      activo: p.activo,
      recetaValida,
      ingredientes: ingredientesCompletos.map(({ ingredienteId, nombreIngrediente, unidad, cantidad }) => ({
        ingredienteId,
        nombreIngrediente,
        unidad,
        cantidad
      }))
    };
  }

  /**
   * Crea un nuevo platillo con su receta
   * IMPORTANTE: No modifica existencias en movimientos_inventario.
   */
  static async crearPlatillo(input: CrearPlatilloInput): Promise<PlatilloDTO> {
    const nombre = input.nombre?.trim();
    if (!nombre) {
      throw new ErrorCatalogo('DATOS_INVALIDOS', 'El nombre del platillo es obligatorio.');
    }

    const precioDec = validarNumeroDecimal(input.precio, 'precio del platillo', {
      positivo: true,
      escalaMax: 2,
      max: 99999999.99,
      codigoError: 'DATOS_INVALIDOS'
    });

    if (!Array.isArray(input.receta) || input.receta.length === 0) {
      throw new ErrorCatalogo('RECETA_INVALIDA', 'El platillo debe incluir al menos un ingrediente en su receta.');
    }

    const idsVistos = new Set<number>();
    for (const item of input.receta) {
      if (idsVistos.has(item.ingredienteId)) {
        throw new ErrorCatalogo('RECETA_INVALIDA', 'No se puede repetir el mismo ingrediente en la receta.');
      }
      idsVistos.add(item.ingredienteId);
    }

    if (process.env.DATABASE_URL) {
      return await ejecutarTransaccion(async (client: PoolClient) => {
        let platilloId: number;
        try {
          const insertPlatilloQuery = `
            INSERT INTO platillos (nombre, precio, activo)
            VALUES ($1, $2, TRUE)
            RETURNING id;
          `;
          const resPlatillo = await client.query(insertPlatilloQuery, [nombre, precioDec.toFixed(2)]);
          platilloId = resPlatillo.rows[0].id;
        } catch (err: any) {
          if (err.code === '23505') {
            throw new ErrorCatalogo('DATOS_INVALIDOS', `Ya existe un platillo registrado con el nombre "${nombre}".`);
          }
          throw err;
        }

        await this.guardarDetalleReceta(client, platilloId, input.receta);
        // Lectura transaccional consistente con el mismo client antes de confirmar
        const res = await this.obtenerPlatilloPorId(platilloId, client);
        return res!;
      });
    }

    // Memoria aislada
    if (platillosMemoria.some((p) => p.nombre.toLowerCase() === nombre.toLowerCase())) {
      throw new ErrorCatalogo('DATOS_INVALIDOS', `Ya existe un platillo registrado con el nombre "${nombre}".`);
    }

    // Validar ingredientes
    for (const item of input.receta) {
      const ing = ingredientesMemoria.find((i) => i.id === item.ingredienteId);
      if (!ing) {
        throw new ErrorCatalogo('RECURSO_NO_ENCONTRADO', `El ingrediente con ID ${item.ingredienteId} no existe.`, 404);
      }
      if (!ing.activo) {
        throw new ErrorCatalogo('INGREDIENTE_INACTIVO', `El ingrediente "${ing.nombre}" está inactivo y no puede utilizarse en una receta.`);
      }
      const cantDec = this.validarCantidadPorUnidad(item.cantidad, ing.unidad, `cantidad de "${ing.nombre}"`);
      if (cantDec.lte(0)) {
        throw new ErrorCatalogo('CANTIDAD_INVALIDA', `La cantidad del ingrediente "${ing.nombre}" debe ser mayor a cero.`);
      }
    }

    const nuevoPlatillo = {
      id: almacenMemoria.proxPlatilloId++,
      nombre,
      precio: precioDec,
      activo: true
    };
    platillosMemoria.push(nuevoPlatillo);

    for (const item of input.receta) {
      const ing = ingredientesMemoria.find((i) => i.id === item.ingredienteId)!;
      const cantDec = this.validarCantidadPorUnidad(item.cantidad, ing.unidad, `cantidad de "${ing.nombre}"`);
      almacenMemoria.recetas.push({
        platilloId: nuevoPlatillo.id,
        ingredienteId: item.ingredienteId,
        cantidad: cantDec
      });
    }

    return (await this.obtenerPlatilloPorId(nuevoPlatillo.id))!;
  }

  /**
   * Actualiza los datos de un platillo y/o su receta
   * IMPORTANTE: No modifica existencias en movimientos_inventario.
   */
  static async actualizarPlatillo(id: number, input: ActualizarPlatilloInput): Promise<PlatilloDTO> {
    const actual = await this.obtenerPlatilloPorId(id);
    if (!actual) {
      throw new ErrorCatalogo('RECURSO_NO_ENCONTRADO', 'El platillo no existe.', 404);
    }

    let nuevoNombre = input.nombre !== undefined ? input.nombre.trim() : actual.nombre;
    if (!nuevoNombre) {
      throw new ErrorCatalogo('DATOS_INVALIDOS', 'El nombre del platillo no puede estar vacío.');
    }

    let nuevoPrecioDec = actual.precio ? new Decimal(actual.precio) : new Decimal(0);
    if (input.precio !== undefined) {
      nuevoPrecioDec = validarNumeroDecimal(input.precio, 'precio del platillo', {
        positivo: true,
        escalaMax: 2,
        max: 99999999.99,
        codigoError: 'DATOS_INVALIDOS'
      });
    }

    let nuevoActivo = input.activo !== undefined ? input.activo : actual.activo;

    if (process.env.DATABASE_URL) {
      return await ejecutarTransaccion(async (client: PoolClient) => {
        if (input.receta !== undefined) {
          if (nuevoActivo && (!Array.isArray(input.receta) || input.receta.length === 0)) {
            throw new ErrorCatalogo('RECETA_INVALIDA', 'Un platillo activo debe tener al menos un ingrediente en su receta.');
          }

          const idsVistos = new Set<number>();
          for (const item of input.receta) {
            if (idsVistos.has(item.ingredienteId)) {
              throw new ErrorCatalogo('RECETA_INVALIDA', 'No se puede repetir el mismo ingrediente en la receta.');
            }
            idsVistos.add(item.ingredienteId);
          }

          await client.query('DELETE FROM receta_detalle WHERE platillo_id = $1;', [id]);
          if (input.receta.length > 0) {
            await this.guardarDetalleReceta(client, id, input.receta);
          }
        }

        try {
          const updatePlatilloQuery = `
            UPDATE platillos
            SET nombre = $1, precio = $2, activo = $3, actualizado_en = CURRENT_TIMESTAMP
            WHERE id = $4;
          `;
          await client.query(updatePlatilloQuery, [nuevoNombre, nuevoPrecioDec.toFixed(2), nuevoActivo, id]);
        } catch (err: any) {
          if (err.code === '23505') {
            throw new ErrorCatalogo('DATOS_INVALIDOS', `Ya existe un platillo registrado con el nombre "${nuevoNombre}".`);
          }
          throw err;
        }

        // Lectura transaccional con el mismo client
        const res = await this.obtenerPlatilloPorId(id, client);
        return res!;
      });
    }

    // Memoria aislada
    const pIndex = platillosMemoria.findIndex((p) => p.id === id);
    if (pIndex !== -1) {
      if (platillosMemoria.some((p) => p.id !== id && p.nombre.toLowerCase() === nuevoNombre.toLowerCase())) {
        throw new ErrorCatalogo('DATOS_INVALIDOS', `Ya existe un platillo registrado con el nombre "${nuevoNombre}".`);
      }
      platillosMemoria[pIndex].nombre = nuevoNombre;
      platillosMemoria[pIndex].precio = nuevoPrecioDec;
      platillosMemoria[pIndex].activo = nuevoActivo;
    }

    if (input.receta !== undefined) {
      if (nuevoActivo && (!Array.isArray(input.receta) || input.receta.length === 0)) {
        throw new ErrorCatalogo('RECETA_INVALIDA', 'Un platillo activo debe tener al menos un ingrediente en su receta.');
      }

      const idsVistos = new Set<number>();
      for (const item of input.receta) {
        if (idsVistos.has(item.ingredienteId)) {
          throw new ErrorCatalogo('RECETA_INVALIDA', 'No se puede repetir el mismo ingrediente en la receta.');
        }
        idsVistos.add(item.ingredienteId);

        const ing = ingredientesMemoria.find((i) => i.id === item.ingredienteId);
        if (!ing) {
          throw new ErrorCatalogo('RECURSO_NO_ENCONTRADO', `El ingrediente con ID ${item.ingredienteId} no existe.`, 404);
        }
        if (!ing.activo) {
          throw new ErrorCatalogo('INGREDIENTE_INACTIVO', `El ingrediente "${ing.nombre}" está inactivo y no puede utilizarse en una receta.`);
        }
        const cantDec = this.validarCantidadPorUnidad(item.cantidad, ing.unidad, `cantidad de "${ing.nombre}"`);
        if (cantDec.lte(0)) {
          throw new ErrorCatalogo('CANTIDAD_INVALIDA', `La cantidad del ingrediente "${ing.nombre}" debe ser mayor a cero.`);
        }
      }

      almacenMemoria.recetas = almacenMemoria.recetas.filter((r) => r.platilloId !== id);
      for (const item of input.receta) {
        const ing = ingredientesMemoria.find((i) => i.id === item.ingredienteId)!;
        const cantDec = this.validarCantidadPorUnidad(item.cantidad, ing.unidad, `cantidad de "${ing.nombre}"`);
        almacenMemoria.recetas.push({
          platilloId: id,
          ingredienteId: item.ingredienteId,
          cantidad: cantDec
        });
      }
    }

    return (await this.obtenerPlatilloPorId(id))!;
  }

  /**
   * Helper privado para validar e insertar los ingredientes de una receta
   */
  private static async guardarDetalleReceta(client: PoolClient, platilloId: number, items: ItemRecetaInput[]): Promise<void> {
    for (const item of items) {
      const ingredienteRes = await client.query(
        'SELECT id, nombre, unidad, activo FROM ingredientes WHERE id = $1;',
        [item.ingredienteId]
      );

      if (ingredienteRes.rows.length === 0) {
        throw new ErrorCatalogo(
          'RECURSO_NO_ENCONTRADO',
          `El ingrediente con ID ${item.ingredienteId} no existe.`,
          404
        );
      }

      const ing = ingredienteRes.rows[0];
      if (!ing.activo) {
        throw new ErrorCatalogo(
          'INGREDIENTE_INACTIVO',
          `El ingrediente "${ing.nombre}" está inactivo y no puede utilizarse en una receta.`
        );
      }

      const cantDec = this.validarCantidadPorUnidad(item.cantidad, ing.unidad as UnidadIngrediente, `cantidad de "${ing.nombre}"`);
      if (cantDec.lte(0)) {
        throw new ErrorCatalogo(
          'CANTIDAD_INVALIDA',
          `La cantidad del ingrediente "${ing.nombre}" en la receta debe ser mayor a cero.`
        );
      }

      await client.query(
        `INSERT INTO receta_detalle (platillo_id, ingrediente_id, cantidad)
         VALUES ($1, $2, $3);`,
        [platilloId, ing.id, cantDec.toString()]
      );
    }
  }

  // Acceso para pruebas de kárdex
  static getMovimientosCount(): number {
    return movimientosMemoria.length;
  }
}
