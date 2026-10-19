import { Router, Request, Response } from 'express';
import { VentasService, ErrorVenta } from '../services/ventas.service';
import { ErrorPromocion } from '../services/promociones.service';
import { ErrorCatalogo } from '../services/catalogo.service';
import { exigirAutenticacion, exigirAdmin } from '../middlewares/auth.middleware';

export const ventasRouter = Router();

// =========================================================================
// RUTAS DE PUNTO DE VENTA Y CONFIRMACIÓN
// =========================================================================

/**
 * POST /api/v1/ventas/confirmar
 * Confirma una orden de venta de forma atómica:
 * - Valida idempotencia (CW-07).
 * - Revalida consistencia de cotización contra la base de datos (CW-14).
 * - Descuenta existencias de inventario en la misma transacción (CW-05 / CW-06).
 * - Persiste orden y detalle con snapshots históricos (CW-15).
 */
ventasRouter.post('/ventas/confirmar', exigirAutenticacion, async (req: Request, res: Response) => {
  try {
    const { usuarioId } = usuarioDeSesion(req);

    const orden = await VentasService.confirmarVenta(req.body, usuarioId);
    res.status(200).json(orden);
  } catch (error: any) {
    manejarError(res, error);
  }
});

/**
 * GET /api/v1/ventas/recuperar/:claveIdempotencia
 * Consulta si una operación previa fue procesada con éxito ante pérdida de respuesta de red (CW-19 / CW-07).
 */
ventasRouter.get('/ventas/recuperar/:claveIdempotencia', exigirAutenticacion, async (req: Request, res: Response) => {
  try {
    const { usuarioId, perfil } = usuarioDeSesion(req);
    const claveIdempotencia = VentasService.normalizarClaveIdempotencia(req.params.claveIdempotencia);

    const orden = await VentasService.buscarPorClaveIdempotencia(claveIdempotencia);

    if (orden) {
      // Regla de control de acceso (CW-02 / Hallazgo 2 de Auditoría 1):
      // Si el usuario es TRABAJADOR, no puede recuperar ni inspeccionar órdenes generadas por otros usuarios
      if (perfil === 'TRABAJADOR' && orden.usuarioId !== usuarioId) {
        return res.status(403).json({
          codigo: 'ACCESO_DENEGADO',
          mensaje: 'No tienes permiso para consultar o recuperar ventas de otros usuarios.',
          detalles: null
        });
      }
      res.json({ encontrada: true, orden });
    } else {
      res.json({ encontrada: false, orden: null });
    }
  } catch (error: any) {
    manejarError(res, error);
  }
});

// =========================================================================
// RUTAS DE HISTORIAL Y COMPROBANTE
// =========================================================================

/**
 * GET /api/v1/ventas/historial
 * Consulta el historial de órdenes y el total confirmado del periodo:
 * - TRABAJADOR: consulta únicamente sus propias ventas (CW-02).
 * - ADMINISTRADOR: consulta todas las ventas de la sucursal.
 * - Las órdenes ANULADAS se excluyen del total confirmado (CW-16).
 */
ventasRouter.get('/ventas/historial', exigirAutenticacion, async (req: Request, res: Response) => {
  try {
    const { usuarioId, perfil } = usuarioDeSesion(req);

    const { fechaInicio, fechaFin } = req.query;

    const resumen = await VentasService.listarHistorial(
      {
        fechaInicio: fechaInicio ? String(fechaInicio) : undefined,
        fechaFin: fechaFin ? String(fechaFin) : undefined
      },
      usuarioId,
      perfil
    );

    res.json(resumen);
  } catch (error: any) {
    manejarError(res, error);
  }
});

/**
 * GET /api/v1/ventas/:id
 * Consulta el comprobante y detalle histórico de una orden por ID.
 */
ventasRouter.get('/ventas/:id', exigirAutenticacion, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        codigo: 'DATOS_INVALIDOS',
        mensaje: 'El ID de la orden debe ser un número entero.',
        detalles: null
      });
    }

    const { usuarioId, perfil } = usuarioDeSesion(req);

    const orden = await VentasService.obtenerPorId(id, usuarioId, perfil);
    res.json(orden);
  } catch (error: any) {
    manejarError(res, error);
  }
});

// =========================================================================
// RUTAS DE ANULACIÓN (EXCLUSIVO ADMINISTRADOR)
// =========================================================================

/**
 * POST /api/v1/ventas/:id/anular
 * Anula una venta completa con motivo obligatorio:
 * - Exclusivo para ADMINISTRADOR (CW-02).
 * - Idempotente (CW-16).
 * - No reintegra inventario automáticamente (CW-16).
 */
ventasRouter.post('/ventas/:id/anular', exigirAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        codigo: 'DATOS_INVALIDOS',
        mensaje: 'El ID de la orden debe ser un número entero.',
        detalles: null
      });
    }

    const { usuarioId, perfil } = usuarioDeSesion(req);
    const motivo = req.body.motivo;

    const ordenAnulada = await VentasService.anularVenta(id, motivo, usuarioId, perfil);
    res.json(ordenAnulada);
  } catch (error: any) {
    manejarError(res, error);
  }
});

// =========================================================================
// HELPERS DE SESIÓN Y ERRORES ESTANDARIZADOS
// =========================================================================

/**
 * Identidad tomada solo de la sesión validada por el middleware (A3-4-03).
 * Sin usuario o perfil no se asume ninguna cuenta ni perfil por defecto.
 */
function usuarioDeSesion(req: Request): { usuarioId: number; perfil: 'ADMINISTRADOR' | 'TRABAJADOR' } {
  const usuario = req.usuario;
  if (!usuario || !Number.isInteger(usuario.id) || (usuario.perfil !== 'ADMINISTRADOR' && usuario.perfil !== 'TRABAJADOR')) {
    throw new ErrorVenta('NO_AUTENTICADO', 'Debes iniciar sesión para realizar esta operación.', 401);
  }
  return { usuarioId: usuario.id, perfil: usuario.perfil };
}

function manejarError(res: Response, error: any) {
  if (error instanceof ErrorVenta) {
    return res.status(error.statusCode).json({
      codigo: error.codigo,
      mensaje: error.message,
      detalles: error.detalles
    });
  }

  if (error instanceof ErrorPromocion) {
    return res.status(error.statusCode).json({
      codigo: error.codigo,
      mensaje: error.message,
      detalles: error.detalles
    });
  }

  if (error instanceof ErrorCatalogo) {
    return res.status(error.statusCode || 400).json({
      codigo: error.codigo,
      mensaje: error.message,
      detalles: error.detalles
    });
  }

  console.error('⚠️ [Error en VentasRouter]:', error);
  res.status(500).json({
    codigo: 'ERROR_INTERNO',
    mensaje: 'Ocurrió un error inesperado al procesar la solicitud de ventas.',
    detalles: process.env.NODE_ENV === 'development' ? error.message : null
  });
}
