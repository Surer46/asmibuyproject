import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-gestion',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="app-container">
      <div class="view-header">
        <div>
          <h2>Panel de Gestión Administrativa</h2>
          <p class="subtitle">Configuración de inventario, recetas y promociones (Solo Administradores)</p>
        </div>
      </div>

      <div class="gestion-grid">
        <div class="card-cupertino gestion-card">
          <span class="material-symbols-rounded icon-gradient">inventory_2</span>
          <h4>Catálogo e Inventario (Área Integrante 2)</h4>
          <p>Alta de platillos, recetas, fijación de stock mínimo y ajustes justificados de existencias.</p>
          <span class="badge badge-verde">Contrato Compartido Listo</span>
        </div>

        <div class="card-cupertino gestion-card">
          <span class="material-symbols-rounded icon-gradient">percent</span>
          <h4>Descuentos y Promociones (Área Integrante 3)</h4>
          <p>Configuración de promociones Porcentaje y NxM sobre un único platillo por promoción.</p>
          <span class="badge badge-verde">Contrato Compartido Listo</span>
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
    .gestion-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }
    .gestion-card {
      padding: 18px 16px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
    .icon-gradient {
      font-size: 34px;
      background: var(--gradiente-naranja-amarillo);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      display: inline-block;
    }
    h4 {
      font-size: 1.05rem;
      font-weight: 600;
      letter-spacing: -0.2px;
    }
    p {
      font-size: 0.82rem;
      line-height: 1.4;
      color: var(--color-texto-secundario);
      flex: 1;
    }

    @media (min-width: 600px) {
      .gestion-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }
      .gestion-card {
        padding: 24px;
      }
    }
  `]
})
export class GestionComponent {
  authService = inject(AuthService);
}
