import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { Router } from '@angular/router';

export interface UsuarioDTO {
  id: number;
  nombre: string;
  correo: string;
  perfil: 'ADMINISTRADOR' | 'TRABAJADOR';
  activo: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private readonly baseUrl = '/api/v1/auth';

  // Reactividad moderna con Signals (Angular 21)
  usuarioActual = signal<UsuarioDTO | null>(null);
  csrfToken = signal<string>('');
  cargando = signal<boolean>(true);

  estaAutenticado = computed(() => !!this.usuarioActual());
  esAdmin = computed(() => this.usuarioActual()?.perfil === 'ADMINISTRADOR');
  esTrabajador = computed(() => this.usuarioActual()?.perfil === 'TRABAJADOR');

  constructor() {
    this.verificarSesionInicial();
  }

  /**
   * Al cargar la app, comprueba si existe una sesión activa en el servidor
   */
  verificarSesionInicial(): void {
    this.cargando.set(true);
    this.http.get<{ usuario: UsuarioDTO }>(`${this.baseUrl}/me`, { withCredentials: true }).pipe(
      catchError(() => {
        this.usuarioActual.set(null);
        return of(null);
      })
    ).subscribe((res) => {
      if (res && res.usuario) {
        this.usuarioActual.set(res.usuario);
        if (this.router.url.includes('/login') || this.router.url === '/') {
          this.router.navigate(['/venta']);
        }
      } else {
        this.usuarioActual.set(null);
      }
      this.cargando.set(false);
    });
  }

  /**
   * Inicia sesión con correo y contraseña
   */
  login(correo: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/login`, { correo, password }, { withCredentials: true }).pipe(
      tap((res) => {
        if (res.exito && res.usuario) {
          this.usuarioActual.set(res.usuario);
          if (res.csrfToken) {
            this.csrfToken.set(res.csrfToken);
          }
          this.router.navigate(['/venta']);
        }
      })
    );
  }

  /**
   * Cierra la sesión en el servidor y limpia el estado local
   */
  logout(): void {
    this.http.post(`${this.baseUrl}/logout`, {}, { withCredentials: true }).subscribe({
      next: () => {
        this.usuarioActual.set(null);
        this.router.navigate(['/login']);
      },
      error: () => {
        this.usuarioActual.set(null);
        this.router.navigate(['/login']);
      }
    });
  }
}
