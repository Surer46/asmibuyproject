import { Router, Request, Response } from 'express';
import { CatalogoService, ErrorCatalogo } from '../services/catalogo.service';
import { exigirAutenticacion, exigirAdmin } from '../middlewares/auth.middleware';

export const catalogoRouter = Router();

// =========================================================================
// RUTAS PÚBLICAS AUTENTICADAS (TRABAJADOR Y ADMINISTRADOR)
// =========================================================================

/**
 * GET /api/v1/catalogo/platillos
 * Retorna los platillos activos con recetas válidas para la venta.
 */
catalogoRouter.get('/catalogo/platillos', exigirAutenticacion, async (_req: Request, res: Response) => {
  try {
    const platillos = await CatalogoService.listarPlatillosPublicos();
    res.json(platillos);
  } catch (error: any) {
    manejarError(res, error);
  }
});

/**
 * GET /api/v1/catalogo/platillos/:id
 * Retorna los detalles de un platillo específico.
 */
catalogoRouter.get('/catalogo/platillos/:id', exigirAutenticacion, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        codigo: 'DATOS_INVALIDOS',
        mensaje: 'El ID del platillo debe ser un número entero.',
        detalles: null
      });
    }

    const platillo = await CatalogoService.obtenerPlatilloPorId(id);
    if (!platillo) {
      return res.status(404).json({
        codigo: 'RECURSO_NO_ENCONTRADO',
        mensaje: 'Platillo no encontrado.',
        detalles: null
      });
    }

    res.json(platillo);
  } catch (error: any) {
    manejarError(res, error);
  }
});

// =========================================================================
// RUTAS DE GESTIÓN ADMINISTRATIVA (SOLO ADMINISTRADOR)
// =========================================================================

/**
 * GET /api/v1/admin/ingredientes
 * Lista todos los ingredientes registrados.
 */
catalogoRouter.get('/admin/ingredientes', exigirAdmin, async (_req: Request, res: Response) => {
  try {
    const ingredientes = await CatalogoService.listarIngredientes();
    res.json(ingredientes);
  } catch (error: any) {
    manejarError(res, error);
  }
});

/**
 * POST /api/v1/admin/ingredientes
 * Crea un nuevo ingrediente con su mínimo obligatorio.
 */
catalogoRouter.post('/admin/ingredientes', exigirAdmin, async (req: Request, res: Response) => {
  try {
    const { nombre, unidad, minimo } = req.body;
    const nuevo = await CatalogoService.crearIngrediente({ nombre, unidad, minimo });
    res.status(201).json(nuevo);
  } catch (error: any) {
    manejarError(res, error);
  }
});

/**
 * PUT /api/v1/admin/ingredientes/:id
 * Actualiza un ingrediente existente respetando la inmutabilidad de unidad si tiene referencias.
 */
catalogoRouter.put('/admin/ingredientes/:id', exigirAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        codigo: 'DATOS_INVALIDOS',
        mensaje: 'El ID del ingrediente debe ser un número entero.',
        detalles: null
      });
    }

    const { nombre, unidad, minimo, activo } = req.body;
    const actualizado = await CatalogoService.actualizarIngrediente(id, { nombre, unidad, minimo, activo });
    res.json(actualizado);
  } catch (error: any) {
    manejarError(res, error);
  }
});

/**
 * GET /api/v1/admin/platillos
 * Lista todos los platillos (incluyendo inactivos y con recetas incompletas).
 */
catalogoRouter.get('/admin/platillos', exigirAdmin, async (_req: Request, res: Response) => {
  try {
    const platillos = await CatalogoService.listarPlatillosAdmin();
    res.json(platillos);
  } catch (error: any) {
    manejarError(res, error);
  }
});

/**
 * POST /api/v1/admin/platillos
 * Crea un nuevo platillo con su receta asociada. No modifica inventario.
 */
catalogoRouter.post('/admin/platillos', exigirAdmin, async (req: Request, res: Response) => {
  try {
    const { nombre, precio, receta } = req.body;
    const nuevo = await CatalogoService.crearPlatillo({ nombre, precio, receta });
    res.status(201).json(nuevo);
  } catch (error: any) {
    manejarError(res, error);
  }
});

/**
 * PUT /api/v1/admin/platillos/:id
 * Actualiza los datos o receta de un platillo existente.
 */
catalogoRouter.put('/admin/platillos/:id', exigirAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        codigo: 'DATOS_INVALIDOS',
        mensaje: 'El ID del platillo debe ser un número entero.',
        detalles: null
      });
    }

    const { nombre, precio, activo, receta } = req.body;
    const actualizado = await CatalogoService.actualizarPlatillo(id, { nombre, precio, activo, receta });
    res.json(actualizado);
  } catch (error: any) {
    manejarError(res, error);
  }
});

/**
 * Helper para estandarizar las respuestas de error
 */
function manejarError(res: Response, error: any) {
  if (error instanceof ErrorCatalogo) {
    return res.status(error.statusCode).json({
      codigo: error.codigo,
      mensaje: error.message,
      detalles: error.detalles
    });
  }

  console.error('⚠️ [Error en CatalogoRouter]:', error);
  res.status(500).json({
    codigo: 'ERROR_INTERNO',
    mensaje: 'Ocurrió un error inesperado al procesar la solicitud en el catálogo.',
    detalles: process.env.NODE_ENV === 'development' ? error.message : null
  });
}
