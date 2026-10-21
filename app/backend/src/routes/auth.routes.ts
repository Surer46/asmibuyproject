import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { LoginRateLimiter } from '../services/login-rate-limiter';
import { exigirAutenticacion } from '../middlewares/auth.middleware';

export const authRouter = Router();

/**
 * GET /api/v1/auth/csrf
 * Obtiene un token anti-CSRF para formularios
 */
authRouter.get('/auth/csrf', (_req: Request, res: Response) => {
  const token = AuthService.generarTokenCSRF();
  res.cookie('asmibuy_csrf', token, {
    httpOnly: false, // Accesible por JavaScript para adjuntar en X-CSRF-Token
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000
  });
  res.json({ csrfToken: token });
});

/**
 * POST /api/v1/auth/login
 * Inicia sesión, crea registro en servidor y responde con cookie HttpOnly
 * Protegido contra ataques de fuerza bruta y análisis de temporización (A3-1-01)
 */
authRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { correo, password } = req.body;

    if (!correo || !password) {
      return res.status(400).json({
        codigo: 'DATOS_INVALIDOS',
        mensaje: 'Correo y contraseña son requeridos.',
        detalles: null
      });
    }

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

    // 1. Verificar bloqueo por límite de intentos fallidos (Rate Limiting)
    const estadoBloqueo = LoginRateLimiter.verificarBloqueo(ip, correo);
    if (estadoBloqueo.bloqueado) {
      res.setHeader('Retry-After', String(estadoBloqueo.reintentarEnSegundos));
      return res.status(429).json({
        codigo: 'DEMASIADOS_INTENTOS',
        mensaje: `Demasiados intentos de acceso fallidos. Por seguridad, intente de nuevo en ${estadoBloqueo.reintentarEnSegundos} segundos.`,
        detalles: {
          reintentarEnSegundos: estadoBloqueo.reintentarEnSegundos
        }
      });
    }

    // 2. Buscar usuario
    const usuario = await AuthService.buscarPorCorreo(correo);

    // 3. Mitigación de timing attack: si el usuario no existe, se calcula bcrypt con un hash ficticio
    let passwordValida = false;
    if (usuario) {
      passwordValida = AuthService.verificarPassword(password, usuario.password_hash);
    } else {
      AuthService.verificarPasswordFalsa(password);
    }

    // 4. Si credenciales son incorrectas (no existe usuario o contraseña no coincide)
    if (!usuario || !passwordValida) {
      const penalizacion = LoginRateLimiter.registrarFallo(ip, correo);
      if (penalizacion.bloqueado) {
        res.setHeader('Retry-After', String(penalizacion.reintentarEnSegundos));
      }
      return res.status(401).json({
        codigo: 'CREDENCIALES_INVALIDAS',
        mensaje: 'El correo o la contraseña son incorrectos.',
        detalles: penalizacion.bloqueado ? { reintentarEnSegundos: penalizacion.reintentarEnSegundos } : null
      });
    }

    // 5. Verificar si la cuenta nominal está activa
    if (!usuario.activo) {
      LoginRateLimiter.registrarFallo(ip, correo);
      return res.status(403).json({
        codigo: 'CUENTA_DESACTIVADA',
        mensaje: 'Esta cuenta ha sido desactivada por el administrador.',
        detalles: null
      });
    }

    // 6. Éxito: Limpiar historial de intentos fallidos para esta IP y correo
    LoginRateLimiter.limpiarExito(ip, correo);

    // Crear sesión en servidor (8 horas)
    const { token } = await AuthService.crearSesion(usuario.id, ip);

    // Generar token CSRF para esta sesión
    const csrfToken = AuthService.generarTokenCSRF();

    // Establecer cookie HttpOnly segura (NUNCA en localStorage)
    res.cookie('asmibuy_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000
    });

    res.cookie('asmibuy_csrf', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000
    });

    res.json({
      exito: true,
      mensaje: `Bienvenido, ${usuario.nombre}`,
      csrfToken,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        perfil: usuario.perfil,
        activo: usuario.activo
      }
    });
  } catch (err: any) {
    console.error('Error durante autenticación:', err.message);
    res.status(500).json({
      codigo: 'ERROR_INTERNO',
      mensaje: 'Error de conexión con la base de datos al autenticar.',
      detalles: null
    });
  }
});

/**
 * POST /api/v1/auth/logout
 * Cierra la sesión activa en el servidor y limpia cookies
 */
authRouter.post('/auth/logout', async (req: Request, res: Response) => {
  try {
    const sesionToken = req.cookies?.asmibuy_session || req.sesionId;
    if (sesionToken) {
      await AuthService.revocarSesion(sesionToken);
    }

    res.clearCookie('asmibuy_session');
    res.clearCookie('asmibuy_csrf');

    res.json({
      exito: true,
      mensaje: 'Sesión finalizada con éxito.'
    });
  } catch (err: any) {
    console.error('Error al revocar sesión en logout:', err.message);
    res.status(500).json({
      codigo: 'ERROR_INTERNO',
      mensaje: 'Error al revocar la sesión en el servidor.',
      detalles: null
    });
  }
});

/**
 * GET /api/v1/auth/me
 * Devuelve el usuario actualmente autenticado
 */
authRouter.get('/auth/me', exigirAutenticacion, (req: Request, res: Response) => {
  const u = req.usuario!;
  let csrfToken = req.cookies?.asmibuy_csrf;
  if (!csrfToken) {
    csrfToken = AuthService.generarTokenCSRF();
    res.cookie('asmibuy_csrf', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000
    });
  }
  res.json({
    csrfToken,
    usuario: {
      id: u.id,
      nombre: u.nombre,
      correo: u.correo,
      perfil: u.perfil,
      activo: u.activo
    }
  });
});
