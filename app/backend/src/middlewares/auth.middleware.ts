import { Request, Response, NextFunction } from 'express';
import { AuthService, Usuario } from '../services/auth.service';

// Extender la interfaz Request de Express para adjuntar el usuario y la sesión
declare global {
  namespace Express {
    interface Request {
      usuario?: Usuario;
      sesionId?: string;
    }
  }
}

/**
 * Middleware para extraer y verificar la sesión desde la cookie HttpOnly
 */
export async function verificarSesion(req: Request, _res: Response, next: NextFunction) {
  const sesionId = req.cookies?.asmibuy_session;
  if (!sesionId) {
    return next();
  }

  const { valida, usuario } = await AuthService.validarSesion(sesionId);
  if (valida && usuario) {
    req.usuario = usuario;
    req.sesionId = sesionId;
  }
  next();
}

/**
 * Middleware para exigir que el usuario tenga una sesión válida
 */
export function exigirAutenticacion(req: Request, res: Response, next: NextFunction) {
  if (!req.usuario) {
    return res.status(401).json({
      codigo: 'NO_AUTENTICADO',
      mensaje: 'Debes iniciar sesión para realizar esta operación.',
      detalles: null
    });
  }
  next();
}

/**
 * Middleware para exigir perfil ADMINISTRADOR
 */
export function exigirAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.usuario) {
    return res.status(401).json({
      codigo: 'NO_AUTENTICADO',
      mensaje: 'Debes iniciar sesión.',
      detalles: null
    });
  }
  if (req.usuario.perfil !== 'ADMINISTRADOR') {
    return res.status(403).json({
      codigo: 'ACCESO_DENEGADO',
      mensaje: 'Acceso denegado: Esta operación requiere perfil de Administrador.',
      detalles: null
    });
  }
  next();
}

/**
 * Middleware de protección CSRF para peticiones mutables (POST, PUT, DELETE, PATCH)
 */
export function validarCSRF(req: Request, res: Response, next: NextFunction) {
  const metodosProtegidos = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (!metodosProtegidos.includes(req.method)) {
    return next();
  }

  // Rutas exentas de CSRF (como el propio login inicial)
  if (req.path === '/api/v1/auth/login' || req.path === '/auth/login') {
    return next();
  }

  const csrfHeader = req.headers['x-csrf-token'];
  const csrfCookie = req.cookies?.asmibuy_csrf;

  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
    return res.status(403).json({
      codigo: 'CSRF_INVALIDO',
      mensaje: 'Token de seguridad CSRF ausente o no coincidente.',
      detalles: null
    });
  }

  next();
}
