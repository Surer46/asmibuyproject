import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    @if (mostrarNavbar()) {
      <!-- Barra superior para Teléfonos Móviles (Cupertino Top Bar) -->
      <header class="top-nav-mobile" aria-label="Encabezado de aplicación móvil">
        <div class="top-accent-line"></div>
        <div class="mobile-brand">
          <div class="mobile-brand-icon">
            <span class="material-symbols-rounded">restaurant_menu</span>
          </div>
          <div class="mobile-brand-titles">
            <span class="mobile-brand-name">Asmibuy</span>
            <span class="mobile-branch-pill">Sucursal Centro</span>
          </div>
        </div>

        <div class="mobile-user-chip">
          <div class="mobile-avatar" [class.avatar-admin]="authService.esAdmin()" [class.avatar-cajero]="!authService.esAdmin()">
            {{ (authService.usuarioActual()?.nombre || 'U').charAt(0).toUpperCase() }}
          </div>
          <div class="mobile-user-details">
            <span class="mobile-user-name">{{ authService.usuarioActual()?.nombre }}</span>
            <span class="mobile-user-role" [class.is-admin]="authService.esAdmin()">
              {{ authService.usuarioActual()?.perfil }}
            </span>
          </div>
        </div>
      </header>

      <!-- Barra superior para PC y tabletas (Desktop Top Bar) -->
      <header class="top-nav-desktop" aria-label="Barra de navegación de escritorio">
        <div class="top-accent-line"></div>
        <div class="brand">
          <div class="desktop-brand-icon">
            <span class="material-symbols-rounded">restaurant_menu</span>
          </div>
          <span class="brand-text">Asmibuy</span>
          <span class="branch-tag">Sucursal Centro</span>
        </div>

        <nav class="desktop-links">
          <a routerLink="/venta" routerLinkActive="active" class="nav-item">
            <span class="material-symbols-rounded">point_of_sale</span>
            <span>Venta</span>
          </a>

          <a routerLink="/avisos" routerLinkActive="active" class="nav-item">
            <span class="material-symbols-rounded">notifications</span>
            <span>Avisos</span>
          </a>

          <a routerLink="/historial" routerLinkActive="active" class="nav-item">
            <span class="material-symbols-rounded">receipt_long</span>
            <span>Historial</span>
          </a>

          @if (authService.esAdmin()) {
            <a routerLink="/gestion" routerLinkActive="active" class="nav-item">
              <span class="material-symbols-rounded">admin_panel_settings</span>
              <span>Gestión</span>
            </a>
          }
        </nav>

        <div class="user-badge-container">
          <div class="user-info">
            <span class="user-name">{{ authService.usuarioActual()?.nombre }}</span>
            <span class="user-role" [class.role-admin]="authService.esAdmin()">
              {{ authService.usuarioActual()?.perfil }}
            </span>
          </div>
          <button (click)="logout()" class="btn-logout" title="Cerrar Sesión">
            <span class="material-symbols-rounded">logout</span>
          </button>
        </div>
      </header>

      <!-- Barra de pestañas inferior para Teléfonos Móviles (Cupertino Bottom Tab Bar) -->
      <nav class="bottom-nav-mobile" aria-label="Navegación principal móvil">
        <a routerLink="/venta" routerLinkActive="active" class="mobile-tab" title="Punto de Venta">
          <div class="tab-icon-wrap">
            <span class="material-symbols-rounded">point_of_sale</span>
          </div>
          <span class="tab-label">Venta</span>
        </a>

        <a routerLink="/avisos" routerLinkActive="active" class="mobile-tab" title="Avisos de Stock">
          <div class="tab-icon-wrap">
            <span class="material-symbols-rounded">notifications</span>
          </div>
          <span class="tab-label">Avisos</span>
        </a>

        <a routerLink="/historial" routerLinkActive="active" class="mobile-tab" title="Historial">
          <div class="tab-icon-wrap">
            <span class="material-symbols-rounded">receipt_long</span>
          </div>
          <span class="tab-label">Historial</span>
        </a>

        @if (authService.esAdmin()) {
          <a routerLink="/gestion" routerLinkActive="active" class="mobile-tab" title="Gestión">
            <div class="tab-icon-wrap">
              <span class="material-symbols-rounded">admin_panel_settings</span>
            </div>
            <span class="tab-label">Gestión</span>
          </a>
        }

        <button (click)="logout()" class="mobile-tab tab-btn" aria-label="Cerrar Sesión" title="Cerrar Sesión">
          <div class="tab-icon-wrap icon-logout">
            <span class="material-symbols-rounded">logout</span>
          </div>
          <span class="tab-label">Salir</span>
        </button>
      </nav>
    }
  `,
  styles: [`
    /* -------------------------------------------------------------
       LÍNEA TRICOLOR DE MARCA (VERDE - NARANJA - AMARILLO)
       ------------------------------------------------------------- */
    .top-accent-line {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--gradiente-marca-tricolor);
    }

    /* -------------------------------------------------------------
       BARRA SUPERIOR MÓVIL (CUPERTINO TOP BAR - PANTALLAS < 768px)
       ------------------------------------------------------------- */
    .top-nav-mobile {
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--color-borde);
      padding: max(12px, env(safe-area-inset-top, 12px)) 16px 10px 16px;
      box-shadow: 0 1px 6px rgba(0, 0, 0, 0.03);
    }

    .mobile-brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .mobile-brand-icon {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      background: var(--gradiente-naranja-amarillo);
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(249, 115, 22, 0.32);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .mobile-brand-icon .material-symbols-rounded {
      font-size: 22px;
    }

    .mobile-brand-titles {
      display: flex;
      flex-direction: column;
    }

    .mobile-brand-name {
      font-weight: 700;
      font-size: 1.15rem;
      letter-spacing: -0.4px;
      color: var(--color-texto);
      line-height: 1.2;
    }

    .mobile-branch-pill {
      font-size: 0.7rem;
      color: var(--color-texto-secundario);
      font-weight: 500;
    }

    .mobile-user-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f5f5f4;
      border: 1px solid var(--color-borde);
      padding: 4px 10px 4px 4px;
      border-radius: 20px;
    }

    .mobile-avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      color: #ffffff;
      font-size: 0.8rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .avatar-admin {
      background: var(--gradiente-naranja-amarillo);
      box-shadow: 0 2px 8px rgba(249, 115, 22, 0.3);
    }

    .avatar-cajero {
      background: var(--gradiente-verde-fresco);
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
    }

    .mobile-user-details {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      line-height: 1.1;
    }

    .mobile-user-name {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--color-texto);
      max-width: 95px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mobile-user-role {
      font-size: 0.65rem;
      font-weight: 700;
      color: var(--token-verde-oscuro);
      text-transform: uppercase;
    }

    .mobile-user-role.is-admin {
      color: var(--token-naranja-oscuro);
    }

    /* -------------------------------------------------------------
       BARRA INFERIOR MÓVIL (CUPERTINO TAB BAR - PANTALLAS < 768px)
       ------------------------------------------------------------- */
    .bottom-nav-mobile {
      display: flex;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      border-top: 1px solid var(--color-borde);
      z-index: 1000;
      min-height: 64px;
      justify-content: space-around;
      align-items: center;
      padding-top: 6px;
      padding-bottom: max(8px, env(safe-area-inset-bottom, 8px));
      box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.04);
    }

    .mobile-tab {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      color: #78716c;
      min-height: 48px;
      padding: 2px 4px;
      font-size: 0.72rem;
      border: none;
      background: transparent;
      cursor: pointer;
      font-family: inherit;
      transition: transform 0.1s ease, color 0.15s ease;
      touch-action: manipulation;
    }

    .mobile-tab:active {
      transform: scale(0.92);
    }

    .tab-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 28px;
      border-radius: 14px;
      transition: background-color 0.2s ease, box-shadow 0.2s ease;
    }

    .tab-icon-wrap .material-symbols-rounded {
      font-size: 24px;
    }

    .tab-label {
      font-weight: 500;
      margin-top: 2px;
      letter-spacing: -0.1px;
    }

    .mobile-tab.active {
      color: var(--token-naranja-oscuro);
    }

    .mobile-tab.active .tab-icon-wrap {
      background: linear-gradient(135deg, #fff7ed 0%, #fefce8 100%);
      color: var(--token-naranja-oscuro);
      box-shadow: inset 0 0 0 1px #fed7aa;
    }

    .mobile-tab.active .tab-label {
      font-weight: 700;
    }

    .icon-logout .material-symbols-rounded {
      color: var(--token-rojo-alerta);
    }

    .tab-btn:active .tab-label {
      color: var(--token-rojo-alerta);
    }

    /* -------------------------------------------------------------
       BARRA DE ESCRITORIO (PANTALLAS >= 768px)
       ------------------------------------------------------------- */
    .top-nav-desktop {
      display: none;
      background: #ffffff;
      border-bottom: 1px solid var(--color-borde);
      padding: 12px 24px;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: var(--sombra-cupertino);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .desktop-brand-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: var(--gradiente-naranja-amarillo);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(249, 115, 22, 0.25);
    }

    .brand-text {
      font-weight: 700;
      font-size: 1.25rem;
      letter-spacing: -0.5px;
    }

    .branch-tag {
      font-size: 0.75rem;
      background: #f5f5f4;
      color: var(--color-texto-secundario);
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 500;
    }

    .desktop-links {
      display: flex;
      gap: 12px;
    }

    .nav-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 10px;
      text-decoration: none;
      color: var(--color-texto);
      font-weight: 500;
      transition: all 0.2s ease;
      min-height: 44px;
    }

    .nav-item:hover {
      background-color: #f5f5f4;
    }

    .nav-item.active {
      background: linear-gradient(135deg, #fff7ed 0%, #fefce8 100%);
      color: var(--token-naranja-oscuro);
      border: 1px solid #fed7aa;
      font-weight: 600;
    }

    .user-badge-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .user-info {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .user-name {
      font-size: 0.9rem;
      font-weight: 600;
    }

    .user-role {
      font-size: 0.7rem;
      color: var(--token-verde-oscuro);
      text-transform: uppercase;
      font-weight: 700;
    }

    .user-role.role-admin {
      color: var(--token-naranja-oscuro);
    }

    .btn-logout {
      background: none;
      border: 1px solid var(--color-borde);
      border-radius: 8px;
      padding: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      color: var(--token-rojo-alerta);
      min-height: 44px;
      min-width: 44px;
      justify-content: center;
      transition: background-color 0.15s ease;
    }

    .btn-logout:hover {
      background-color: var(--token-rojo-fondo);
    }

    /* -------------------------------------------------------------
       TRANSICIÓN RESPONSIVA ENTRE MÓVIL Y ESCRITORIO
       ------------------------------------------------------------- */
    @media (min-width: 768px) {
      .top-nav-mobile {
        display: none;
      }
      .bottom-nav-mobile {
        display: none;
      }
      .top-nav-desktop {
        display: flex;
      }
    }
  `]
})
export class NavbarComponent {
  authService = inject(AuthService);
  private router = inject(Router);

  // Detecta reactivamente si la pantalla actual es el login
  esRutaLogin = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e: NavigationEnd) => e.urlAfterRedirects.includes('/login') || e.url.includes('/login')),
      startWith(this.router.url.includes('/login'))
    ),
    { initialValue: this.router.url.includes('/login') }
  );

  // La barra SOLO se muestra si el usuario está autenticado Y NO está en la pantalla de login
  mostrarNavbar = computed(() => {
    return this.authService.estaAutenticado() && !this.esRutaLogin();
  });

  logout(): void {
    this.authService.logout();
  }
}
