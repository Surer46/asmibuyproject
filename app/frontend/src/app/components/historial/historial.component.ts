import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="app-container">
      <div class="view-header">
        <div>
          <h2>Historial de Ventas</h2>
          <p class="subtitle">
            {{ authService.esAdmin() ? 'Consultando todas las ventas de la sucursal' : 'Consultando exclusivamente tus ventas del turno' }}
          </p>
        </div>
      </div>

      <div class="card-cupertino placeholder-card">
        <span class="material-symbols-rounded feature-icon">receipt_long</span>
        <h3>Registro de Órdenes y Comprobantes (Área Integrante 4)</h3>
        <p>
          Este espacio está conectado al sistema de permisos: los administradores podrán consultar todas las ventas y procesar anulaciones, mientras que los trabajadores solo consultarán sus propias ventas.
        </p>
        <div class="status-box">
          <span class="badge badge-verde">Base W1-04 Integrada</span>
          <span class="badge badge-amarillo">Esperando Integración W4-04</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .view-header {
      margin-bottom: 16px;
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
      line-height: 1.35;
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
      .placeholder-card {
        padding: 48px 24px;
      }
    }
  `]
})
export class HistorialComponent {
  authService = inject(AuthService);
}
