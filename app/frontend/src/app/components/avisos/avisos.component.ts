import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

interface AvisoIngrediente {
  id: number;
  nombre: string;
  existencia: string;
  minimo: string;
  unidad: 'g' | 'ml' | 'pieza';
  estado: 'AGOTADO' | 'BAJO_STOCK' | 'NORMAL';
}

@Component({
  selector: 'app-avisos',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="app-container">
      <div class="view-header">
        <div>
          <h2>Avisos de Inventario</h2>
          <p class="subtitle">Condición actual de ingredientes y existencias críticas</p>
        </div>
        <button (click)="recargarAvisos()" class="btn-cupertino btn-secundario btn-sm">
          <span class="material-symbols-rounded">refresh</span>
          <span>Actualizar</span>
        </button>
      </div>

      <div class="avisos-list">
        @for (aviso of listaAvisos; track aviso.id) {
          <div class="card-cupertino aviso-item" [class.borde-rojo]="aviso.estado === 'AGOTADO'" [class.borde-amarillo]="aviso.estado === 'BAJO_STOCK'" [class.borde-verde]="aviso.estado === 'NORMAL'">
            <div class="aviso-icon-wrapper" [class.bg-rojo]="aviso.estado === 'AGOTADO'" [class.bg-amarillo]="aviso.estado === 'BAJO_STOCK'" [class.bg-verde]="aviso.estado === 'NORMAL'">
              <span class="material-symbols-rounded">
                {{ aviso.estado === 'AGOTADO' ? 'error' : aviso.estado === 'BAJO_STOCK' ? 'warning' : 'check_circle' }}
              </span>
            </div>

            <div class="aviso-details">
              <h4>{{ aviso.nombre }}</h4>
              <p class="stock-info">
                Existencia actual: <strong>{{ aviso.existencia }} {{ aviso.unidad }}</strong> (Mínimo: {{ aviso.minimo }} {{ aviso.unidad }})
              </p>
            </div>

            <div class="aviso-badge">
              @if (aviso.estado === 'AGOTADO') {
                <span class="badge badge-rojo">AGOTADO</span>
              } @else if (aviso.estado === 'BAJO_STOCK') {
                <span class="badge badge-amarillo">BAJO STOCK</span>
              } @else {
                <span class="badge badge-verde">NORMAL</span>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .view-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      gap: 12px;
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
      line-height: 1.3;
    }
    .btn-sm {
      min-height: 44px;
      padding: 8px 16px;
      font-size: 0.85rem;
      flex-shrink: 0;
      border-radius: 12px;
    }
    .avisos-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .aviso-item {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 0;
      padding: 14px 16px;
      border-radius: 16px;
      transition: transform 0.12s ease;
    }
    .aviso-item:active {
      transform: scale(0.98);
    }
    .aviso-item.borde-rojo {
      border-left: 5px solid var(--token-rojo-alerta);
    }
    .aviso-item.borde-amarillo {
      border-left: 5px solid var(--token-amarillo-aviso);
    }
    .aviso-item.borde-verde {
      border-left: 5px solid var(--token-verde-confirmar);
    }
    .aviso-icon-wrapper {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .bg-rojo {
      background: var(--token-rojo-fondo);
      color: var(--token-rojo-alerta);
      border: 1px solid var(--token-rojo-borde);
    }
    .bg-amarillo {
      background: linear-gradient(135deg, #fefce8 0%, #fff7ed 100%);
      color: var(--token-amarillo-aviso);
      border: 1px solid #fed7aa;
    }
    .bg-verde {
      background: var(--token-verde-fondo);
      color: var(--token-verde-confirmar);
      border: 1px solid var(--token-verde-borde);
    }
    .aviso-details {
      flex: 1;
      min-width: 0; /* Previene desborde de texto en móvil */
    }
    .aviso-details h4 {
      font-size: 0.98rem;
      font-weight: 600;
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .stock-info {
      font-size: 0.8rem;
      color: var(--color-texto-secundario);
      line-height: 1.3;
    }
    .aviso-badge {
      flex-shrink: 0;
    }

    @media (max-width: 480px) {
      .view-header {
        flex-direction: column;
        align-items: flex-start;
      }
      .view-header .btn-sm {
        width: 100%;
      }
      .aviso-item {
        flex-wrap: wrap;
      }
      .aviso-details {
        flex: 1 1 calc(100% - 60px);
      }
      .aviso-badge {
        width: 100%;
        display: flex;
        justify-content: flex-end;
        padding-top: 4px;
        border-top: 1px dashed var(--color-borde);
      }
    }
  `]
})
export class AvisosComponent {
  authService = inject(AuthService);

  listaAvisos: AvisoIngrediente[] = [
    { id: 1, nombre: 'Carne de Res Molida', existencia: '0.000', minimo: '500.000', unidad: 'g', estado: 'AGOTADO' },
    { id: 2, nombre: 'Pan de Hamburguesa', existencia: '4', minimo: '10', unidad: 'pieza', estado: 'BAJO_STOCK' },
    { id: 3, nombre: 'Queso Cheddar', existencia: '25', minimo: '8', unidad: 'pieza', estado: 'NORMAL' },
    { id: 4, nombre: 'Aceite Vegetal', existencia: '150.000', minimo: '500.000', unidad: 'ml', estado: 'BAJO_STOCK' }
  ];

  recargarAvisos() {
    // Al recargar se consulta el estado vigente
    console.log('Avisos actualizados');
  }
}
