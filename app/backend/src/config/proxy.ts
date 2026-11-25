/**
 * Configuración de `trust proxy` de Express a partir de TRUST_PROXY (A-ENT-02).
 *
 * Detrás de un proxy o balanceador (Render, Nginx, Cloudflare, mismo origen HTTPS),
 * Express ve la IP del proxy en `req.ip` y todas las cajas parecerían una sola IP:
 * el límite de intentos de login bloquearía a todo el personal a la vez.
 * Con `trust proxy`, Express toma la IP real del cliente de X-Forwarded-For.
 *
 * Valores admitidos de TRUST_PROXY (por defecto desactivado):
 *   - vacío, "false", "0" ...... desactivado (desarrollo local sin proxy).
 *   - "1", "2", ... ............ número de proxies de confianza delante de la API (recomendado: 1 en Render).
 *   - "loopback", "uniquelocal", "10.0.0.0/8, 127.0.0.1" ... lista de subredes o direcciones de confianza.
 *   - "true" ................... confía en cualquier origen: NO recomendado, porque cualquier cliente
 *                                podría falsificar X-Forwarded-For y evadir el límite de intentos.
 */
export type ValorTrustProxy = false | true | number | string;

export function interpretarTrustProxy(valor: string | undefined | null): ValorTrustProxy {
  const texto = (valor ?? '').trim();
  if (texto === '' || /^(false|0|no|off)$/i.test(texto)) {
    return false;
  }
  if (/^true$/i.test(texto)) {
    return true;
  }
  if (/^\d+$/.test(texto)) {
    return Number(texto);
  }
  return texto;
}

export function describirTrustProxy(valor: ValorTrustProxy): string {
  if (valor === false) return 'desactivado';
  if (valor === true) return 'activo para cualquier origen (no recomendado: X-Forwarded-For falsificable)';
  if (typeof valor === 'number') return `activo: ${valor} proxy(s) de confianza`;
  return `activo para: ${valor}`;
}
