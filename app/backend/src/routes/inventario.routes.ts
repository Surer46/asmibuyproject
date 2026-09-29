import { Router, Request, Response } from 'express';
import { InventarioService } from '../services/inventario.service';
import { CatalogoService, ErrorCatalogo } from '../services/catalogo.service';
import { exigirAutenticacion, exigirAdmin } from '../middlewares/auth.middleware';

export const inventarioRouter = Router();

// =========================================================================
// RUTAS DE GESTIÓN DE MOVIMIENTOS (SOLO ADMINISTRADOR)
// =========================================================================

/**
 * POST /api/v1/admin/movimientos/entrada
 * Registra una entrada de insumos con autor, fecha, cantidad positiva y motivo.
 */
inventarioRouter.post('/admin/movimientos/entrada', exigirAdmin, async (req: Request, res: Response) => {
  try {
    const { ingredienteId, cantidad, motivo } = req.body;
    if (!ingredienteId || cantidad === undefined) {
      return res.status(400).json({
        codigo: 'DATOS_INVALIDOS',
        mensaje: 'Los campos ingredienteId y cantidad son obligatorios.',
        detalles: null
      });
    }

    const usuarioId = req.usuario!.id;
    const movimiento = await InventarioService.registrarEntrada({
      ingredienteId: Number(ingredienteId),
      cantidad,
      motivo,
      usuarioId
    });

    res.status(201).json(movimiento);
  } catch (error: any) {
    manejarError(res, error);
  }
});

/**
 * POST /api/v1/admin/movimientos/ajuste
 * Registra un ajuste de stock (positivo o negativo) con motivo obligatorio.
 * Garantiza que el stock no sea negativo (CW-04).
 */
inventarioRouter.post('/admin/movimientos/ajuste', exigirAdmin, async (req: Request, res: Response) => {
  try {
    const { ingredienteId, cantidad, motivo } = req.body;
    if (!ingredienteId || cantidad === undefined || !motivo) {
      return res.status(400).json({
        codigo: 'DATOS_INVALIDOS',
        mensaje: 'Los campos ingredienteId, cantidad y motivo son obligatorios.',
        detalles: null
      });
    }

    const usuarioId = req.usuario!.id;
    const movimiento = await InventarioService.registrarAjuste({
      ingredienteId: Number(ingredienteId),
      cantidad,
      motivo,
      usuarioId
    });

    res.status(201).json(movimiento);
  } catch (error: any) {
    manejarError(res, error);
  }
});

/**
 * GET /api/v1/admin/movimientos
 * Consulta el historial de movimientos de inventario (filtrable por ingredienteId).
 */
inventarioRouter.get('/admin/movimientos', exigirAdmin, async (req: Request, res: Response) => {
  try {
    const ingredienteIdParam = req.query.ingredienteId ? Number(req.query.ingredienteId) : undefined;
    const movimientos = await InventarioService.listarMovimientos(ingredienteIdParam);
    res.json(movimientos);
  } catch (error: any) {
    manejarError(res, error);
  }
});

// =========================================================================
// RUTAS DE CONSULTA DE INVENTARIO (TRABAJADOR Y ADMINISTRADOR)
// =========================================================================

/**
 * GET /api/v1/inventario/existencias
 * Consulta de existencias actuales y umbrales mínimos.
 */
inventarioRouter.get('/inventario/existencias', exigirAutenticacion, async (_req: Request, res: Response) => {
  try {
    const existencias = await CatalogoService.listarIngredientes();
    res.json(existencias);
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

  console.error('⚠️ [Error en InventarioRouter]:', error);
  res.status(500).json({
    codigo: 'ERROR_INTERNO',
    mensaje: 'Ocurrió un error inesperado al procesar la operación de inventario.',
    detalles: process.env.NODE_ENV === 'development' ? error.message : null
  });
}
