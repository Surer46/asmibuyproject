import Decimal from 'decimal.js';
import { PoolClient } from 'pg';
import { pool } from '../config/database';
import { ejecutarTransaccion } from './db.service';

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

// =========================================================================
// ALMACÉN EN MEMORIA (FALLBACK PARA DESARROLLO SIN DATABASE_URL)
// =========================================================================
interface IngredienteInterno {
  id: number;
  nombre: string;
  unidad: UnidadIngrediente;
  minimo: Decimal;
  activo: boolean;
}

interface PlatilloInterno {
  id: number;
  nombre: string;
  precio: Decimal;
  activo: boolean;
}

interface RecetaDetalleInterno {
  platilloId: number;
  ingredienteId: number;
  cantidad: Decimal;
}

interface MovimientoInterno {
  id: number;
  ingredienteId: number;
  tipo: 'ENTRADA' | 'AJUSTE' | 'CONSUMO_VENTA';
  cantidad: Decimal;
  motivo: string;
  usuarioId: number;
  ordenId?: number | null;
}

let ingredientesMemoria: IngredienteInterno[] = [
  { id: 1, nombre: 'Pan de Hamburguesa', unidad: 'pieza', minimo: new Decimal(20), activo: true },
  { id: 2, nombre: 'Carne de Res', unidad: 'g', minimo: new Decimal(2000), activo: true },
  { id: 3, nombre: 'Queso Amarillo', unidad: 'pieza', minimo: new Decimal(15), activo: true },
  { id: 4, nombre: 'Papas Congeladas', unidad: 'g', minimo: new Decimal(1000), activo: true }
];

let platillosMemoria: PlatilloInterno[] = [
  { id: 1, nombre: 'Hamburguesa Clásica', precio: new Decimal('120.00'), activo: true }
];

let recetasMemoria: RecetaDetalleInterno[] = [
  { platilloId: 1, ingredienteId: 1, cantidad: new Decimal(1) },
  { platilloId: 1, ingredienteId: 2, cantidad: new Decimal(150) },
  { platilloId: 1, ingredienteId: 3, cantidad: new Decimal(1) }
];

let movimientosMemoria: MovimientoInterno[] = [
  { id: 1, ingredienteId: 1, tipo: 'ENTRADA', cantidad: new Decimal(50), motivo: 'Stock inicial', usuarioId: 1 },
  { id: 2, ingredienteId: 2, tipo: 'ENTRADA', cantidad: new Decimal(5000), motivo: 'Stock inicial', usuarioId: 1 },
  { id: 3, ingredienteId: 3, tipo: 'ENTRADA', cantidad: new Decimal(40), motivo: 'Stock inicial', usuarioId: 1 }
];

let proxIngredienteId = 5;
let proxPlatilloId = 2;

export class CatalogoService {
  /**
   * Valida la precisión de una cantidad según la unidad del ingrediente
   */
  static validarCantidadPorUnidad(cantidad: Decimal, unidad: UnidadIngrediente, campo: string) {
    if (cantidad.lt(0)) {
      throw new ErrorCatalogo('CANTIDAD_INVALIDA', `La ${campo} no puede ser negativa.`);
    }

    if (unidad === 'pieza') {
      if (!cantidad.mod(1).equals(0)) {
        throw new ErrorCatalogo('CANTIDAD_INVALIDA', `La ${campo} para unidades tipo 'pieza' debe ser un número entero.`);
      }
    } else {
      if (cantidad.decimalPlaces() > 3) {
        throw new ErrorCatalogo('CANTIDAD_INVALIDA', `La ${campo} para '${unidad}' no puede tener más de 3 decimales.`);
      }
    }
  }

  /**
   * Lista todos los ingredientes con su existencia actual calculada y su estado de stock
   */
  static async listarIngredientes(): Promise<IngredienteDTO[]> {
    if (process.env.DATABASE_URL) {
      try {
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
      } catch (e) {
        console.warn('Fallback a memoria al listar ingredientes');
      }
    }

    // Memoria
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
   * Obtiene un ingrediente por su identificador
   */
  static async obtenerIngredientePorId(id: number): Promise<IngredienteDTO | null> {
    if (process.env.DATABASE_URL) {
      try {
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
        const { rows } = await pool.query(query, [id]);
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
      } catch (e) {
        console.warn('Fallback a memoria al obtener ingrediente');
      }
    }

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
   * Crea un nuevo ingrediente con su mínimo individual
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

    let minimoDec = new Decimal(input.minimo !== undefined ? input.minimo : 0);
    this.validarCantidadPorUnidad(minimoDec, input.unidad, 'cantidad mínima');

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
        console.warn('Fallback a memoria al crear ingrediente');
      }
    }

    // Memoria
    if (ingredientesMemoria.some((i) => i.nombre.toLowerCase() === nombre.toLowerCase())) {
      throw new ErrorCatalogo('DATOS_INVALIDOS', `Ya existe un ingrediente registrado con el nombre "${nombre}".`);
    }

    const nuevoIng: IngredienteInterno = {
      id: proxIngredienteId++,
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
        try {
          const referenciasRecetas = await pool.query('SELECT COUNT(*) FROM receta_detalle WHERE ingrediente_id = $1', [id]);
          const referenciasMovimientos = await pool.query('SELECT COUNT(*) FROM movimientos_inventario WHERE ingrediente_id = $1', [id]);
          const totalReferencias = parseInt(referenciasRecetas.rows[0].count, 10) + parseInt(referenciasMovimientos.rows[0].count, 10);
          if (totalReferencias > 0) {
            throw new ErrorCatalogo(
              'UNIDAD_INMUTABLE',
              'No se puede cambiar la unidad de un ingrediente que ya está referenciado en recetas o movimientos de inventario.'
            );
          }
        } catch (e: any) {
          if (e instanceof ErrorCatalogo) throw e;
          console.warn('Fallback a memoria al validar inmutabilidad de unidad');
        }
      }

      // Validación en memoria
      const tieneRecetas = recetasMemoria.some((r) => r.ingredienteId === id);
      const tieneMovimientos = movimientosMemoria.some((m) => m.ingredienteId === id);
      if (tieneRecetas || tieneMovimientos) {
        throw new ErrorCatalogo(
          'UNIDAD_INMUTABLE',
          'No se puede cambiar la unidad de un ingrediente que ya está referenciado en recetas o movimientos de inventario.'
        );
      }
    }

    let nuevoMinimoDec = input.minimo !== undefined ? new Decimal(input.minimo) : new Decimal(actual.minimo);
    this.validarCantidadPorUnidad(nuevoMinimoDec, nuevaUnidad, 'cantidad mínima');

    let nuevoActivo = input.activo !== undefined ? input.activo : actual.activo;

    // Si se intenta desactivar el ingrediente, verificar si platillos activos lo usan
    if (actual.activo && nuevoActivo === false) {
      if (process.env.DATABASE_URL) {
        try {
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
        } catch (e: any) {
          if (e instanceof ErrorCatalogo) throw e;
          console.warn('Fallback a memoria al validar uso de ingrediente');
        }
      }

      // Validación en memoria
      const platillosActivosConIng = recetasMemoria
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
        console.warn('Fallback a memoria al actualizar ingrediente');
      }
    }

    // Memoria
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
      try {
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
      } catch (e) {
        console.warn('Fallback a memoria al listar platillos');
      }
    }

    // Memoria
    return platillosMemoria
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((p) => {
        const ingredientesReceta = recetasMemoria.filter((r) => r.platilloId === p.id);
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
   * Obtiene un platillo por su identificador
   */
  static async obtenerPlatilloPorId(id: number): Promise<PlatilloDTO | null> {
    if (process.env.DATABASE_URL) {
      try {
        const query = `SELECT id, nombre, precio, activo FROM platillos WHERE id = $1;`;
        const { rows } = await pool.query(query, [id]);
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
          const { rows: recetasRows } = await pool.query(recetasQuery, [id]);

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
      } catch (e) {
        console.warn('Fallback a memoria al obtener platillo');
      }
    }

    const p = platillosMemoria.find((item) => item.id === id);
    if (!p) return null;

    const ingredientesReceta = recetasMemoria.filter((r) => r.platilloId === p.id);
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

    if (input.precio === undefined || input.precio === null) {
      throw new ErrorCatalogo('DATOS_INVALIDOS', 'El precio del platillo es obligatorio.');
    }

    const precioDec = new Decimal(input.precio);
    if (precioDec.lte(0)) {
      throw new ErrorCatalogo('DATOS_INVALIDOS', 'El precio del platillo debe ser un importe positivo mayor a cero.');
    }
    if (precioDec.decimalPlaces() > 2) {
      throw new ErrorCatalogo('DATOS_INVALIDOS', 'El precio del platillo no puede tener más de 2 decimales.');
    }

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
      try {
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
          const res = await this.obtenerPlatilloPorId(platilloId);
          return res!;
        });
      } catch (e: any) {
        if (e instanceof ErrorCatalogo) throw e;
        console.warn('Fallback a memoria al crear platillo');
      }
    }

    // Memoria
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
      const cantDec = new Decimal(item.cantidad);
      if (cantDec.lte(0)) {
        throw new ErrorCatalogo('CANTIDAD_INVALIDA', `La cantidad del ingrediente "${ing.nombre}" debe ser mayor a cero.`);
      }
      this.validarCantidadPorUnidad(cantDec, ing.unidad, `cantidad de "${ing.nombre}"`);
    }

    const nuevoPlatillo: PlatilloInterno = {
      id: proxPlatilloId++,
      nombre,
      precio: precioDec,
      activo: true
    };
    platillosMemoria.push(nuevoPlatillo);

    for (const item of input.receta) {
      recetasMemoria.push({
        platilloId: nuevoPlatillo.id,
        ingredienteId: item.ingredienteId,
        cantidad: new Decimal(item.cantidad)
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
      nuevoPrecioDec = new Decimal(input.precio);
      if (nuevoPrecioDec.lte(0)) {
        throw new ErrorCatalogo('DATOS_INVALIDOS', 'El precio del platillo debe ser positivo.');
      }
      if (nuevoPrecioDec.decimalPlaces() > 2) {
        throw new ErrorCatalogo('DATOS_INVALIDOS', 'El precio del platillo no puede tener más de 2 decimales.');
      }
    }

    let nuevoActivo = input.activo !== undefined ? input.activo : actual.activo;

    if (process.env.DATABASE_URL) {
      try {
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

          const res = await this.obtenerPlatilloPorId(id);
          return res!;
        });
      } catch (e: any) {
        if (e instanceof ErrorCatalogo) throw e;
        console.warn('Fallback a memoria al actualizar platillo');
      }
    }

    // Memoria
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
        const cantDec = new Decimal(item.cantidad);
        if (cantDec.lte(0)) {
          throw new ErrorCatalogo('CANTIDAD_INVALIDA', `La cantidad del ingrediente "${ing.nombre}" debe ser mayor a cero.`);
        }
        this.validarCantidadPorUnidad(cantDec, ing.unidad, `cantidad de "${ing.nombre}"`);
      }

      recetasMemoria = recetasMemoria.filter((r) => r.platilloId !== id);
      for (const item of input.receta) {
        recetasMemoria.push({
          platilloId: id,
          ingredienteId: item.ingredienteId,
          cantidad: new Decimal(item.cantidad)
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

      const cantDec = new Decimal(item.cantidad);
      if (cantDec.lte(0)) {
        throw new ErrorCatalogo(
          'CANTIDAD_INVALIDA',
          `La cantidad del ingrediente "${ing.nombre}" en la receta debe ser mayor a cero.`
        );
      }

      this.validarCantidadPorUnidad(cantDec, ing.unidad as UnidadIngrediente, `cantidad de "${ing.nombre}"`);

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
