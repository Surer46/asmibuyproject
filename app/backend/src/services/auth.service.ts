import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../config/database';

export interface Usuario {
  id: number;
  nombre: string;
  correo: string;
  password_hash: string;
  perfil: 'ADMINISTRADOR' | 'TRABAJADOR';
  activo: boolean;
  creado_en: string;
}

export interface Sesion {
  id: string; // Hash SHA-256 del token de sesión (nunca el token en claro)
  usuario_id: number;
  expira_en: Date;
  revocada: boolean;
  ip_creacion?: string;
  creado_en: string;
}

// Almacén exclusivo para pruebas unitarias aisladas en entorno NODE_ENV=test sin BD
const usuariosTestMemoria: Usuario[] = [];
const sesionesTestMemoria: Map<string, Sesion> = new Map();

/**
 * Servicio de Autenticación y Cuentas Nominales (Spec v2.1)
 */
export class AuthService {
  /**
   * Hashea una contraseña con bcrypt y salting seguro
   */
  static hashPassword(password: string): string {
    return bcrypt.hashSync(password, 10);
  }

  /**
   * Compara una contraseña con su hash
   */
  static verificarPassword(password: string, hash: string): boolean {
    return bcrypt.compareSync(password, hash);
  }

  /**
   * Genera un identificador de sesión criptográficamente seguro
   */
  static generarIdSesion(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Genera el hash criptográfico SHA-256 de un token de sesión para persistencia segura
   */
  static hashTokenSesion(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Genera un token CSRF criptográficamente seguro
   */
  static generarTokenCSRF(): string {
    return crypto.randomBytes(24).toString('hex');
  }

  /**
   * Métodos auxiliares para pruebas automatizadas aisladas
   */
  static resetearMemoriaTest(): void {
    usuariosTestMemoria.length = 0;
    sesionesTestMemoria.clear();
  }

  static agregarUsuarioTest(usuario: Usuario): void {
    usuariosTestMemoria.push(usuario);
  }

  /**
   * Busca un usuario por correo electrónico
   */
  static async buscarPorCorreo(correo: string): Promise<Usuario | null> {
    if (!correo) return null;
    const correoNormalizado = correo.trim().toLowerCase();

    if (process.env.DATABASE_URL) {
      // Consulta directa a PostgreSQL. Si falla la BD, se lanza el error sin fallback a memoria.
      const res = await pool.query('SELECT * FROM usuarios WHERE LOWER(correo) = $1', [correoNormalizado]);
      return res.rows[0] || null;
    }

    if (process.env.NODE_ENV === 'test') {
      return usuariosTestMemoria.find(u => u.correo.toLowerCase() === correoNormalizado) || null;
    }

    throw new Error('DATABASE_URL no está configurada y el entorno no es de prueba aislada.');
  }

  /**
   * Busca un usuario por ID
   */
  static async buscarPorId(id: number): Promise<Usuario | null> {
    if (process.env.DATABASE_URL) {
      // Consulta directa a PostgreSQL sin fallback silencioso
      const res = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
      return res.rows[0] || null;
    }

    if (process.env.NODE_ENV === 'test') {
      return usuariosTestMemoria.find(u => u.id === id) || null;
    }

    throw new Error('DATABASE_URL no está configurada y el entorno no es de prueba aislada.');
  }

  /**
   * Crea una nueva sesión en el servidor con duración de 8 horas.
   * Guarda únicamente el hash SHA-256 del token en la base de datos (sesiones.id),
   * retornando el token en claro sólo para la cookie HttpOnly.
   */
  static async crearSesion(usuarioId: number, ip?: string): Promise<{ token: string; sesion: Sesion }> {
    const rawToken = this.generarIdSesion();
    const tokenHash = this.hashTokenSesion(rawToken);
    const expiraEn = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 horas

    const sesion: Sesion = {
      id: tokenHash,
      usuario_id: usuarioId,
      expira_en: expiraEn,
      revocada: false,
      ip_creacion: ip,
      creado_en: new Date().toISOString()
    };

    if (process.env.DATABASE_URL) {
      await pool.query(
        'INSERT INTO sesiones (id, usuario_id, expira_en, ip_creacion) VALUES ($1, $2, $3, $4)',
        [tokenHash, usuarioId, expiraEn, ip || null]
      );
    } else if (process.env.NODE_ENV === 'test') {
      sesionesTestMemoria.set(tokenHash, sesion);
    } else {
      throw new Error('DATABASE_URL no configurada para crear sesión.');
    }

    return { token: rawToken, sesion };
  }

  /**
   * Valida una sesión: recibe el token en claro de la cookie, calcula su hash SHA-256
   * y comprueba existencia, expiración, revocación y estado activo del usuario.
   */
  static async validarSesion(token: string): Promise<{ valida: boolean; usuario: Usuario | null }> {
    if (!token) return { valida: false, usuario: null };
    const tokenHash = this.hashTokenSesion(token);
    let sesion: Sesion | null = null;

    if (process.env.DATABASE_URL) {
      const res = await pool.query('SELECT * FROM sesiones WHERE id = $1', [tokenHash]);
      if (res.rows.length > 0) sesion = res.rows[0];
    } else if (process.env.NODE_ENV === 'test') {
      sesion = sesionesTestMemoria.get(tokenHash) || null;
    } else {
      throw new Error('DATABASE_URL no configurada para validar sesión.');
    }

    if (!sesion) return { valida: false, usuario: null };

    // Validar expiración o revocación
    if (sesion.revocada || new Date(sesion.expira_en) <= new Date()) {
      return { valida: false, usuario: null };
    }

    // Obtener y validar el usuario
    const usuario = await this.buscarPorId(sesion.usuario_id);
    if (!usuario || !usuario.activo) {
      return { valida: false, usuario: null };
    }

    return { valida: true, usuario };
  }

  /**
   * Revoca / cierra una sesión en el servidor calculando el hash del token.
   */
  static async revocarSesion(token: string): Promise<void> {
    if (!token) return;
    const tokenHash = this.hashTokenSesion(token);

    if (process.env.DATABASE_URL) {
      await pool.query('UPDATE sesiones SET revocada = TRUE WHERE id = $1', [tokenHash]);
    } else if (process.env.NODE_ENV === 'test') {
      const s = sesionesTestMemoria.get(tokenHash);
      if (s) s.revocada = true;
    }
  }

  /**
   * Utilidad de mantenimiento: Crear cuenta nominal directamente en la base de datos
   */
  static async crearCuentaNominal(
    nombre: string,
    correo: string,
    passwordPlano: string,
    perfil: 'ADMINISTRADOR' | 'TRABAJADOR'
  ): Promise<Usuario> {
    const password_hash = this.hashPassword(passwordPlano);
    const correoNormalizado = correo.trim().toLowerCase();

    if (process.env.DATABASE_URL) {
      const res = await pool.query(
        `INSERT INTO usuarios (nombre, correo, password_hash, perfil, activo)
         VALUES ($1, $2, $3, $4, TRUE) RETURNING *`,
        [nombre.trim(), correoNormalizado, password_hash, perfil]
      );
      return res.rows[0];
    }

    if (process.env.NODE_ENV === 'test') {
      const nuevoUsuario: Usuario = {
        id: usuariosTestMemoria.length + 1,
        nombre: nombre.trim(),
        correo: correoNormalizado,
        password_hash,
        perfil,
        activo: true,
        creado_en: new Date().toISOString()
      };
      usuariosTestMemoria.push(nuevoUsuario);
      return nuevoUsuario;
    }

    throw new Error('DATABASE_URL requerida para crear cuentas nominales.');
  }
}
