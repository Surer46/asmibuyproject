import { Router, Request, Response } from 'express';
import { PromocionesService, ErrorPromocion } from '../services/promociones.service';
import { exigirAutenticacion, exigirAdmin } from '../middlewares/auth.middleware';

export const promocionesRouter = Router();

// =========================================================================
// RUTAS DE CONSULTA Y COTIZACIÓN (AUTENTICADOS: TRABAJADOR Y ADMIN)
// =========================================================================

/**
 * GET /api/v1/promociones
 * Lista todas las promociones del sistema con cálculo dinámico de vigencia efectiva.
 */
promocionesRouter.get('/promociones', exigirAutenticacion, async (_req: Request, res: Response) => {
  try {
    const promociones = await PromocionesService.listarPromociones();
    res.json(promociones);
  } catch (error: any) {
    manejarError(res, error);
  }
});

/**
 * GET /api/v1/promociones/:id
 * Consulta una promoción específica por identificador numérico.
 */
promocionesRouter.get('/promociones/:id', exigirAutenticacion, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        codigo: 'DATOS_INVALIDOS',
        mensaje: 'El ID de la promoción debe ser un número entero.',
        detalles: null
      });
    }

    const promocion = await PromocionesService.obtenerPorId(id);
    res.json(promocion);
  } catch (error: any) {
    manejarError(res, error);
  }
});

/**
 * POST /api/v1/promociones/cotizar
 * Evalúa los platillos y cantidades de una orden y aplica la mejor promoción única.
 */
promocionesRouter.post('/promociones/cotizar', exigirAutenticacion, async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        codigo: 'DATOS_INVALIDOS',
        mensaje: "El cuerpo de la solicitud debe incluir un arreglo 'items'.",
        detalles: null
      });
    }

    const cotizacion = await PromocionesService.cotizarOrden(items);
    res.json(cotizacion);
  } catch (error: any) {
    manejarError(res, error);
  }
});

/**
 * POST /api/v1/promociones/validar-cotizacion
 * Revalida la consistencia de una cotización previa antes de confirmar la venta (CW-14).
 */
promocionesRouter.post('/promociones/validar-cotizacion', exigirAutenticacion, async (req: Request, res: Response) => {
  try {
    const cotizacionPrevia = req.body;
    if (!cotizacionPrevia || !Array.isArray(cotizacionPrevia.partidas)) {
      return res.status(400).json({
        codigo: 'DATOS_INVALIDOS',
        mensaje: 'La cotización previa enviada no tiene una estructura válida.',
        detalles: null
      });
    }

    const validada = await PromocionesService.validarConsistenciaCotizacion(cotizacionPrevia);
    res.json({
      valida: true,
      cotizacion: validada
    });
  } catch (error: any) {
    manejarError(res, error);
  }
});

// =========================================================================
// RUTAS ADMINISTRATIVAS (SOLO ADMINISTRADOR)
// =========================================================================

/**
 * POST /api/v1/promociones
 * Crea una nueva promoción (temporal o permanente, porcentaje o NxM).
 */
promocionesRouter.post('/promociones', exigirAdmin, async (req: Request, res: Response) => {
  try {
    const usuarioId = (req as any).usuario?.id || 1;
    const { nombre, platilloId, tipo, porcentaje, n, m, duracion, fechaInicio, fechaFin } = req.body;

    const creada = await PromocionesService.crearPromocion(
      {
        nombre,
        platilloId: Number(platilloId),
        tipo,
        porcentaje,
        n: n !== undefined && n !== null ? Number(n) : undefined,
        m: m !== undefined && m !== null ? Number(m) : undefined,
        duracion,
        fechaInicio,
        fechaFin
      },
      usuarioId
    );

    res.status(201).json(creada);
  } catch (error: any) {
    manejarError(res, error);
  }
});

/**
 * PUT /api/v1/promociones/:id
 * Modifica los datos de una promoción existente no retirada.
 */
promocionesRouter.put('/promociones/:id', exigirAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        codigo: 'DATOS_INVALIDOS',
        mensaje: 'El ID de la promoción debe ser un número entero.',
        detalles: null
      });
    }

    const usuarioId = (req as any).usuario?.id || 1;
    const { nombre, platilloId, tipo, porcentaje, n, m, duracion, fechaInicio, fechaFin, estado } = req.body;

    const actualizada = await PromocionesService.actualizarPromocion(
      id,
      {
        nombre,
        platilloId: platilloId !== undefined ? Number(platilloId) : undefined,
        tipo,
        porcentaje,
        n: n !== undefined && n !== null ? Number(n) : undefined,
        m: m !== undefined && m !== null ? Number(m) : undefined,
        duracion,
        fechaInicio,
        fechaFin,
        estado
      },
      usuarioId
    );

    res.json(actualizada);
  } catch (error: any) {
    manejarError(res, error);
  }
});

/**
 * PATCH /api/v1/promociones/:id/estado
 * Cambia el estado operativo de una promoción (ACTIVA / INACTIVA).
 */
promocionesRouter.patch('/promociones/:id/estado', exigirAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        codigo: 'DATOS_INVALIDOS',
        mensaje: 'El ID de la promoción debe ser un número entero.',
        detalles: null
      });
    }

    const { estado } = req.body;
    if (!estado) {
      return res.status(400).json({
        codigo: 'DATOS_INVALIDOS',
        mensaje: "El campo 'estado' es requerido.",
        detalles: null
      });
    }

    const usuarioId = (req as any).usuario?.id || 1;
    const actualizada = await PromocionesService.cambiarEstado(id, estado, usuarioId);
    res.json(actualizada);
  } catch (error: any) {
    manejarError(res, error);
  }
});

/**
 * DELETE /api/v1/promociones/:id
 * Retira una promoción permanentemente (baja lógica inmutable).
 */
promocionesRouter.delete('/promociones/:id', exigirAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        codigo: 'DATOS_INVALIDOS',
        mensaje: 'El ID de la promoción debe ser un número entero.',
        detalles: null
      });
    }

    const usuarioId = (req as any).usuario?.id || 1;
    const retirada = await PromocionesService.retirarPromocion(id, usuarioId);
    res.json(retirada);
  } catch (error: any) {
    manejarError(res, error);
  }
});

/**
 * Helper para estandarizar las respuestas de error
 */
function manejarError(res: Response, error: any) {
  if (error instanceof ErrorPromocion) {
    return res.status(error.statusCode).json({
      codigo: error.codigo,
      mensaje: error.message,
      detalles: error.detalles
    });
  }

  console.error('⚠️ [Error en PromocionesRouter]:', error);
  res.status(500).json({
    codigo: 'ERROR_INTERNO',
    mensaje: 'Ocurrió un error inesperado al procesar la solicitud de promociones.',
    detalles: process.env.NODE_ENV === 'development' ? error.message : null
  });
}
