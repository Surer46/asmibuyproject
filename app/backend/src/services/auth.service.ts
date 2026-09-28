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
  id: string;
  usuario_id: number;
  expira_en: Date;
  revocada: boolean;
  ip_creacion?: string;
  creado_en: string;
}

// Almacén seguro en memoria para desarrollo local
const usuariosEnMemoria: Usuario[] = [
  {
    id: 1,
    nombre: 'Administrador General',
    correo: 'admin@asmibuy.com',
    password_hash: bcrypt.hashSync('Admin1234!', 10),
    perfil: 'ADMINISTRADOR',
    activo: true,
    creado_en: new Date().toISOString()
  },
  {
    id: 2,
    nombre: 'Trabajador de Turno',
    correo: 'cajero@asmibuy.com',
    password_hash: bcrypt.hashSync('Cajero1234!', 10),
    perfil: 'TRABAJADOR',
    activo: true,
    creado_en: new Date().toISOString()
  }
];

const sesionesEnMemoria: Map<string, Sesion> = new Map();

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
   * Genera un identificador de sesión seguro y aleatorio
   */
  static generarIdSesion(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Genera un token CSRF criptográficamente seguro
   */
  static generarTokenCSRF(): string {
    return crypto.randomBytes(24).toString('hex');
  }

  /**
   * Busca un usuario por correo electrónico
   */
  static async buscarPorCorreo(correo: string): Promise<Usuario | null> {
    if (process.env.DATABASE_URL) {
      try {
        const res = await pool.query('SELECT * FROM usuarios WHERE correo = $1', [correo.toLowerCase()]);
        return res.rows[0] || null;
      } catch (e) {
        console.warn('Fallback a memoria al buscar usuario por BD');
      }
    }
    return usuariosEnMemoria.find(u => u.correo.toLowerCase() === correo.toLowerCase()) || null;
  }

  /**
   * Busca un usuario por ID
   */
  static async buscarPorId(id: number): Promise<Usuario | null> {
    if (process.env.DATABASE_URL) {
      try {
        const res = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
        return res.rows[0] || null;
      } catch (e) {
        console.warn('Fallback a memoria al buscar usuario por ID');
      }
    }
    return usuariosEnMemoria.find(u => u.id === id) || null;
  }

  /**
   * Crea una nueva sesión en el servidor con duración de 8 horas
   */
  static async crearSesion(usuarioId: number, ip?: string): Promise<Sesion> {
    const id = this.generarIdSesion();
    const expiraEn = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 horas

    const sesion: Sesion = {
      id,
      usuario_id: usuarioId,
      expira_en: expiraEn,
      revocada: false,
      ip_creacion: ip,
      creado_en: new Date().toISOString()
    };

    if (process.env.DATABASE_URL) {
      try {
        await pool.query(
          'INSERT INTO sesiones (id, usuario_id, expira_en, ip_creacion) VALUES ($1, $2, $3, $4)',
          [id, usuarioId, expiraEn, ip || null]
        );
      } catch (e) {
        sesionesEnMemoria.set(id, sesion);
      }
    } else {
      sesionesEnMemoria.set(id, sesion);
    }

    return sesion;
  }

  /**
   * Valida una sesión: comprueba existencia, expiración, revocación y estado activo del usuario
   */
  static async validarSesion(sesionId: string): Promise<{ valida: boolean; usuario: Usuario | null }> {
    let sesion: Sesion | null = null;

    if (process.env.DATABASE_URL) {
      try {
        const res = await pool.query('SELECT * FROM sesiones WHERE id = $1', [sesionId]);
        if (res.rows.length > 0) sesion = res.rows[0];
      } catch (e) {
        sesion = sesionesEnMemoria.get(sesionId) || null;
      }
    } else {
      sesion = sesionesEnMemoria.get(sesionId) || null;
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
   * Revoca / cierra una sesión en el servidor
   */
  static async revocarSesion(sesionId: string): Promise<void> {
    if (process.env.DATABASE_URL) {
      try {
        await pool.query('UPDATE sesiones SET revocada = TRUE WHERE id = $1', [sesionId]);
      } catch (e) {
        const s = sesionesEnMemoria.get(sesionId);
        if (s) s.revocada = true;
      }
    } else {
      const s = sesionesEnMemoria.get(sesionId);
      if (s) s.revocada = true;
    }
  }

  /**
   * Utilidad de mantenimiento: Crear cuenta nominal sin pantalla pública de usuarios
   */
  static async crearCuentaNominal(
    nombre: string,
    correo: string,
    passwordPlano: string,
    perfil: 'ADMINISTRADOR' | 'TRABAJADOR'
  ): Promise<Usuario> {
    const password_hash = this.hashPassword(passwordPlano);
    const nuevoUsuario: Usuario = {
      id: usuariosEnMemoria.length + 1,
      nombre,
      correo: correo.toLowerCase(),
      password_hash,
      perfil,
      activo: true,
      creado_en: new Date().toISOString()
    };

    if (process.env.DATABASE_URL) {
      const res = await pool.query(
        `INSERT INTO usuarios (nombre, correo, password_hash, perfil, activo)
         VALUES ($1, $2, $3, $4, TRUE) RETURNING *`,
        [nombre, correo.toLowerCase(), password_hash, perfil]
      );
      return res.rows[0];
    }

    usuariosEnMemoria.push(nuevoUsuario);
    return nuevoUsuario;
  }
}
