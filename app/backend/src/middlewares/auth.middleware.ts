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

export function esOrigenPermitido(origin?: string): boolean {
  if (!origin) return true;

  try {
    const parsed = new URL(origin);
    const host = parsed.hostname;

    if (host === 'localhost' || host === '127.0.0.1') {
      return true;
    }

    const origenesConfigurados = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
      : [];
    if (origenesConfigurados.includes(origin) || origenesConfigurados.includes(parsed.origin)) {
      return true;
    }

    if (process.env.NODE_ENV !== 'production') {
      const esIpPrivada = /^(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/.test(host);
      if (esIpPrivada) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Middleware para extraer y verificar la sesión desde la cookie HttpOnly
 */
export async function verificarSesion(req: Request, _res: Response, next: NextFunction) {
  const sesionToken = req.cookies?.asmibuy_session;
  if (!sesionToken) {
    return next();
  }

  try {
    const { valida, usuario } = await AuthService.validarSesion(sesionToken);
    if (valida && usuario) {
      req.usuario = usuario;
      req.sesionId = sesionToken;
    }
  } catch (err: any) {
    console.error('Error al verificar sesión en base de datos:', err.message);
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

  // Validar origen si la cabecera Origin o Referer está presente
  let originHeader: string | undefined = req.headers.origin as string;
  if (!originHeader && req.headers.referer) {
    try {
      originHeader = new URL(req.headers.referer).origin;
    } catch {
      // Ignorar URL malformada
    }
  }

  if (originHeader && !esOrigenPermitido(originHeader)) {
    return res.status(403).json({
      codigo: 'ORIGEN_NO_PERMITIDO',
      mensaje: 'Petición rechazada: El origen de la petición no está autorizado.',
      detalles: null
    });
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
