/**
 * Servicio de Limitación de Intentos de Login (Login Rate Limiter)
 * Cumple con Auditoría 3 — Hallazgo A3-1-01 (W1-03, CW-01)
 *
 * Aplica limitación de tasa por IP y por correo normalizado con espera creciente
 * para mitigar ataques de fuerza bruta y denegación de servicio.
 */

export interface EstadoIntento {
  intentosFallidos: number;
  primerFallo: number;
  ultimoFallo: number;
  bloqueadoHasta: number;
}

export interface ResultadoVerificacionRateLimit {
  bloqueado: boolean;
  reintentarEnSegundos: number;
  intentosRestantes?: number;
}

export class LoginRateLimiter {
  // Almacén en memoria de intentos fallidos indexado por clave compuesta (ip + '|' + correo)
  private static intentosPorClave: Map<string, EstadoIntento> = new Map();
  // Almacén de intentos fallidos indexado solo por IP
  private static intentosPorIp: Map<string, EstadoIntento> = new Map();

  // Umbral de intentos permitidos antes de aplicar bloqueo temporal
  public static readonly MAX_INTENTOS_SIN_BLOQUEO = 5;

  // Ventana de expiración de intentos (15 minutos)
  private static readonly VENTANA_EXPIRACION_MS = 15 * 60 * 1000;

  private static normalizarClave(ip: string, correo?: string): string {
    const ipLimpia = (ip || '0.0.0.0').trim();
    const correoLimpio = (correo || '').trim().toLowerCase();
    return `${ipLimpia}|${correoLimpio}`;
  }

  /**
   * Calcula el tiempo de penalización en segundos según el número de fallos consecutivos
   * Implementa espera creciente (progressive backoff)
   */
  private static calcularTiempoBloqueoSegundos(intentosFallidos: number): number {
    if (intentosFallidos < this.MAX_INTENTOS_SIN_BLOQUEO) {
      return 0;
    }
    const exceso = intentosFallidos - this.MAX_INTENTOS_SIN_BLOQUEO;
    switch (exceso) {
      case 0:
        return 30; // 5 fallos: 30 segundos
      case 1:
        return 60; // 6 fallos: 1 minuto
      case 2:
        return 180; // 7 fallos: 3 minutos
      case 3:
        return 300; // 8 fallos: 5 minutos
      default:
        return 900; // 9+ fallos: 15 minutos máximo
    }
  }

  /**
   * Limpia registros expirados para no acumular memoria
   */
  private static depurarExpirados(ahora: number) {
    for (const [k, estado] of this.intentosPorClave.entries()) {
      if (ahora - estado.ultimoFallo > this.VENTANA_EXPIRACION_MS && ahora > estado.bloqueadoHasta) {
        this.intentosPorClave.delete(k);
      }
    }
    for (const [ip, estado] of this.intentosPorIp.entries()) {
      if (ahora - estado.ultimoFallo > this.VENTANA_EXPIRACION_MS && ahora > estado.bloqueadoHasta) {
        this.intentosPorIp.delete(ip);
      }
    }
  }

  /**
   * Verifica si la IP o la combinación IP+correo se encuentran temporalmente bloqueadas
   */
  static verificarBloqueo(ip: string, correo?: string): ResultadoVerificacionRateLimit {
    const ahora = Date.now();
    this.depurarExpirados(ahora);

    // 1. Verificar bloqueo por IP
    const ipLimpia = (ip || '0.0.0.0').trim();
    const estadoIp = this.intentosPorIp.get(ipLimpia);
    if (estadoIp && estadoIp.bloqueadoHasta > ahora) {
      const segundos = Math.ceil((estadoIp.bloqueadoHasta - ahora) / 1000);
      return { bloqueado: true, reintentarEnSegundos: segundos };
    }

    // 2. Verificar bloqueo por clave combinada (IP + correo)
    const clave = this.normalizarClave(ip, correo);
    const estadoClave = this.intentosPorClave.get(clave);
    if (estadoClave && estadoClave.bloqueadoHasta > ahora) {
      const segundos = Math.ceil((estadoClave.bloqueadoHasta - ahora) / 1000);
      return { bloqueado: true, reintentarEnSegundos: segundos };
    }

    const fallosActuales = Math.max(estadoIp?.intentosFallidos || 0, estadoClave?.intentosFallidos || 0);
    const intentosRestantes = Math.max(0, this.MAX_INTENTOS_SIN_BLOQUEO - fallosActuales);

    return {
      bloqueado: false,
      reintentarEnSegundos: 0,
      intentosRestantes
    };
  }

  /**
   * Registra un intento fallido de autenticación y aplica bloqueo creciente si se alcanza el umbral
   */
  static registrarFallo(ip: string, correo?: string): ResultadoVerificacionRateLimit {
    const ahora = Date.now();
    const ipLimpia = (ip || '0.0.0.0').trim();
    const clave = this.normalizarClave(ip, correo);

    // Actualizar estado por clave combinada
    const estadoPrevioClave = this.intentosPorClave.get(clave);
    const fallosClave = (estadoPrevioClave ? estadoPrevioClave.intentosFallidos : 0) + 1;
    const segundosBloqueoClave = this.calcularTiempoBloqueoSegundos(fallosClave);
    const bloqueadoHastaClave = segundosBloqueoClave > 0 ? ahora + segundosBloqueoClave * 1000 : 0;

    this.intentosPorClave.set(clave, {
      intentosFallidos: fallosClave,
      primerFallo: estadoPrevioClave ? estadoPrevioClave.primerFallo : ahora,
      ultimoFallo: ahora,
      bloqueadoHasta: bloqueadoHastaClave
    });

    // Actualizar estado por IP
    const estadoPrevioIp = this.intentosPorIp.get(ipLimpia);
    const fallosIp = (estadoPrevioIp ? estadoPrevioIp.intentosFallidos : 0) + 1;
    const segundosBloqueoIp = this.calcularTiempoBloqueoSegundos(fallosIp);
    const bloqueadoHastaIp = segundosBloqueoIp > 0 ? ahora + segundosBloqueoIp * 1000 : 0;

    this.intentosPorIp.set(ipLimpia, {
      intentosFallidos: fallosIp,
      primerFallo: estadoPrevioIp ? estadoPrevioIp.primerFallo : ahora,
      ultimoFallo: ahora,
      bloqueadoHasta: bloqueadoHastaIp
    });

    const maxSegundos = Math.max(segundosBloqueoClave, segundosBloqueoIp);
    if (maxSegundos > 0) {
      return {
        bloqueado: true,
        reintentarEnSegundos: maxSegundos
      };
    }

    const fallosActuales = Math.max(fallosClave, fallosIp);
    return {
      bloqueado: false,
      reintentarEnSegundos: 0,
      intentosRestantes: Math.max(0, this.MAX_INTENTOS_SIN_BLOQUEO - fallosActuales)
    };
  }

  /**
   * Limpia los registros de intentos fallidos al completarse una autenticación exitosa
   */
  static limpiarExito(ip: string, correo?: string): void {
    const ipLimpia = (ip || '0.0.0.0').trim();
    const clave = this.normalizarClave(ip, correo);
    this.intentosPorClave.delete(clave);
    this.intentosPorIp.delete(ipLimpia);
  }

  /**
   * Resetea completamente el almacén (para entorno de pruebas)
   */
  static resetear(): void {
    this.intentosPorClave.clear();
    this.intentosPorIp.clear();
  }
}
