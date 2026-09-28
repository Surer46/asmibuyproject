import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-venta',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="app-container">
      <div class="view-header">
        <div>
          <h2>Punto de Venta</h2>
          <p class="subtitle">Selección de platillos y registro de órdenes</p>
        </div>
        <div class="user-chip">
          <span class="material-symbols-rounded">account_circle</span>
          <span>{{ authService.usuarioActual()?.nombre }} ({{ authService.usuarioActual()?.perfil }})</span>
        </div>
      </div>

      <div class="card-cupertino placeholder-card">
        <span class="material-symbols-rounded feature-icon">point_of_sale</span>
        <h3>Módulo de Venta y Carrito (Área Integrante 4)</h3>
        <p>
          Este espacio está listo con el marco de diseño compartido, sesión activa y cliente transaccional para que el Integrante 4 monte la selección de platillos, carrito, cálculo de promociones y confirmación de la venta.
        </p>
        <div class="status-box">
          <span class="badge badge-verde">Base W1-04 Integrada</span>
          <span class="badge badge-amarillo">Esperando Integración W4-03</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .view-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 10px;
    }
    h2 {
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--color-texto);
      letter-spacing: -0.3px;
    }
    .subtitle {
      font-size: 0.82rem;
      color: var(--color-texto-secundario);
    }
    .user-chip {
      display: none;
    }
    .placeholder-card {
      text-align: center;
      padding: 32px 18px;
    }
    .feature-icon {
      font-size: 48px;
      background: var(--gradiente-naranja-amarillo);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 12px;
      display: inline-block;
    }
    .placeholder-card h3 {
      font-size: 1.1rem;
      margin-bottom: 8px;
    }
    .placeholder-card p {
      max-width: 520px;
      margin: 0 auto 18px auto;
      font-size: 0.85rem;
      line-height: 1.45;
      color: var(--color-texto-secundario);
    }
    .status-box {
      display: flex;
      justify-content: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    @media (min-width: 768px) {
      .user-chip {
        display: flex;
        align-items: center;
        gap: 6px;
        background: #ffffff;
        padding: 6px 12px;
        border-radius: 20px;
        border: 1px solid var(--color-borde);
        font-size: 0.85rem;
        font-weight: 500;
      }
      .placeholder-card {
        padding: 48px 24px;
      }
    }
  `]
})
export class VentaComponent {
  authService = inject(AuthService);
}
