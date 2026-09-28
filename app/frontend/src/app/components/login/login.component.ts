import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="login-page">
      <div class="login-card card-cupertino">
        <div class="brand-header">
          <div class="icon-circle">
            <span class="material-symbols-rounded filled">restaurant_menu</span>
          </div>
          <h1>Asmibuy</h1>
          <p class="subtitle">Acceso exclusivo para empleados de sucursal</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="login-form">
          <div class="form-group">
            <label for="correo">Correo Electrónico</label>
            <div class="input-wrapper">
              <span class="material-symbols-rounded input-icon">mail</span>
              <input
                id="correo"
                type="email"
                inputmode="email"
                autocapitalize="none"
                autocorrect="off"
                spellcheck="false"
                formControlName="correo"
                placeholder="ejemplo@asmibuy.com"
                autocomplete="username"
                class="form-input"
              />
            </div>
            @if (form.get('correo')?.hasError('required') && form.get('correo')?.touched) {
              <span class="error-text">El correo es obligatorio.</span>
            }
          </div>

          <div class="form-group">
            <label for="password">Contraseña</label>
            <div class="input-wrapper">
              <span class="material-symbols-rounded input-icon">lock</span>
              <input
                id="password"
                [type]="mostrarPassword ? 'text' : 'password'"
                formControlName="password"
                placeholder="Ingresa tu contraseña"
                autocomplete="current-password"
                class="form-input"
              />
              <button
                type="button"
                (click)="mostrarPassword = !mostrarPassword"
                class="toggle-pass-btn"
                [attr.aria-label]="mostrarPassword ? 'Ocultar contraseña' : 'Ver contraseña'"
              >
                <span class="material-symbols-rounded">
                  {{ mostrarPassword ? 'visibility_off' : 'visibility' }}
                </span>
              </button>
            </div>
            @if (form.get('password')?.hasError('required') && form.get('password')?.touched) {
              <span class="error-text">La contraseña es obligatoria.</span>
            }
          </div>

          @if (errorMensaje) {
            <div class="error-banner" role="alert">
              <span class="material-symbols-rounded">error</span>
              <span>{{ errorMensaje }}</span>
            </div>
          }

          <button
            type="submit"
            class="btn-cupertino btn-naranja btn-full"
            [disabled]="form.invalid || cargando"
          >
            @if (cargando) {
              <span class="material-symbols-rounded spin">progress_activity</span>
              <span>Iniciando sesión...</span>
            } @else {
              <span>Entrar al Sistema</span>
              <span class="material-symbols-rounded">arrow_forward</span>
            }
          </button>
        </form>

        <div class="quick-access">
          <p class="quick-title">Cuentas rápidas de prueba:</p>
          <div class="quick-buttons">
            <button type="button" (click)="cargarCredenciales('admin')" class="btn-quick admin">
              🔑 Admin
            </button>
            <button type="button" (click)="cargarCredenciales('cajero')" class="btn-quick cajero">
              👤 Trabajador
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh;
      min-height: 100dvh; /* Soporte para altura dinámica de navegadores móviles */
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      padding-top: max(16px, env(safe-area-inset-top, 16px));
      padding-bottom: max(16px, env(safe-area-inset-bottom, 16px));
      background: var(--color-fondo);
    }
    .login-card {
      width: 100%;
      max-width: 400px;
      padding: 28px 20px;
      margin: 0;
      border-radius: 20px;
      border: 1px solid var(--color-borde);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    }
    .brand-header {
      text-align: center;
      margin-bottom: 24px;
    }
    .icon-circle {
      width: 62px;
      height: 62px;
      border-radius: 20px;
      background: var(--gradiente-naranja-amarillo);
      color: #ffffff;
      box-shadow: 0 8px 24px rgba(249, 115, 22, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 12px auto;
    }
    .icon-circle .material-symbols-rounded {
      font-size: 34px;
    }
    h1 {
      font-size: 1.65rem;
      font-weight: 700;
      color: var(--color-texto);
      letter-spacing: -0.5px;
      margin-bottom: 4px;
    }
    .subtitle {
      font-size: 0.85rem;
      color: var(--color-texto-secundario);
    }
    .login-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--color-texto);
    }
    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }
    .input-icon {
      position: absolute;
      left: 14px;
      color: #a8a29e;
      pointer-events: none;
      font-size: 22px;
    }
    .form-input {
      width: 100%;
      min-height: 48px;
      padding: 12px 14px 12px 46px;
      border-radius: 12px;
      border: 1px solid var(--color-borde);
      background: #fafaf9;
      font-size: 16px; /* 16px exactos previene zoom involuntario en iOS Safari */
      font-family: inherit;
      color: var(--color-texto);
      transition: all 0.2s ease;
    }
    .form-input:focus {
      background: #ffffff;
      border-color: var(--token-naranja-primario);
      box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.2);
      outline: none;
    }
    .toggle-pass-btn {
      position: absolute;
      right: 4px;
      min-height: 44px;
      min-width: 44px;
      background: none;
      border: none;
      cursor: pointer;
      color: #a8a29e;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
    }
    .error-text {
      font-size: 0.75rem;
      color: var(--token-rojo-alerta);
      font-weight: 500;
    }
    .error-banner {
      background: var(--token-rojo-fondo);
      color: var(--token-rojo-alerta);
      border: 1px solid var(--token-rojo-borde);
      padding: 12px 14px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .btn-full {
      width: 100%;
      margin-top: 6px;
      min-height: 48px;
    }
    .spin {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      100% { transform: rotate(360deg); }
    }
    .quick-access {
      margin-top: 22px;
      padding-top: 16px;
      border-top: 1px dashed var(--color-borde);
      text-align: center;
    }
    .quick-title {
      font-size: 0.75rem;
      color: var(--color-texto-secundario);
      margin-bottom: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .quick-buttons {
      display: flex;
      gap: 10px;
    }
    .btn-quick {
      flex: 1;
      min-height: 44px;
      border-radius: 12px;
      border: 1px solid var(--color-borde);
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      font-family: inherit;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: transform 0.12s ease, box-shadow 0.15s ease;
    }
    .btn-quick:active {
      transform: scale(0.96);
    }
    .btn-quick.admin {
      color: #c2410c;
      border-color: #fed7aa;
      background: linear-gradient(135deg, #fff7ed 0%, #fefce8 100%);
    }
    .btn-quick.cajero {
      color: #047857;
      border-color: #a7f3d0;
      background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%);
    }
  `]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  mostrarPassword = false;
  cargando = false;
  errorMensaje = '';

  form: FormGroup = this.fb.group({
    correo: ['admin@asmibuy.com', [Validators.required, Validators.email]],
    password: ['Admin1234!', [Validators.required]]
  });

  cargarCredenciales(tipo: 'admin' | 'cajero') {
    if (tipo === 'admin') {
      this.form.patchValue({ correo: 'admin@asmibuy.com', password: 'Admin1234!' });
    } else {
      this.form.patchValue({ correo: 'cajero@asmibuy.com', password: 'Cajero1234!' });
    }
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.cargando = true;
    this.errorMensaje = '';

    const { correo, password } = this.form.value;
    this.authService.login(correo, password).subscribe({
      next: () => {
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        this.errorMensaje = err.error?.mensaje || 'Error al conectar con el servidor de autenticación.';
      }
    });
  }
}
