import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Espera a que termine la verificación inicial de sesión (GET /auth/me) antes de decidir.
 * Sin esto, al recargar una ruta protegida la sesión aún no está cargada y se redirigía a /venta (H-03).
 */
function esperarSesion() {
  const auth = inject(AuthService);
  return toObservable(auth.cargando).pipe(
    filter((cargando) => !cargando),
    take(1),
    map(() => auth)
  );
}

/**
 * Sólo acepta rutas internas de la app para evitar redirecciones abiertas.
 */
export function rutaInternaSegura(url: string | null | undefined): string {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\') || url.startsWith('/login')) {
    return '/venta';
  }
  return url;
}

export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  return esperarSesion().pipe(
    map((auth) =>
      auth.estaAutenticado() ? true : router.createUrlTree(['/login'], { queryParams: { volver: state.url } })
    )
  );
};

export const adminGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  return esperarSesion().pipe(
    map((auth) => {
      if (!auth.estaAutenticado()) {
        return router.createUrlTree(['/login'], { queryParams: { volver: state.url } });
      }
      return auth.esAdmin() ? true : router.createUrlTree(['/venta']);
    })
  );
};

/**
 * Si ya hay sesión y se abre /login, regresa a la ruta solicitada (o /venta).
 */
export const guestGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  return esperarSesion().pipe(
    map((auth) =>
      auth.estaAutenticado() ? router.parseUrl(rutaInternaSegura(route.queryParamMap.get('volver'))) : true
    )
  );
};
