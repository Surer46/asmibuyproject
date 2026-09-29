import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventarioApiService, AvisoStockDTO } from '../../services/inventario.service';
import { AuthService } from '../../services/auth.service';

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
        <button (click)="recargarAvisos()" class="btn-cupertino btn-secundario btn-sm" [disabled]="cargando()">
          <span class="material-symbols-rounded" [class.icono-rotando]="cargando()">refresh</span>
          <span>{{ cargando() ? 'Consultando...' : 'Actualizar' }}</span>
        </button>
      </div>

      <!-- Estado de carga -->
      <div *ngIf="cargando() && avisos().length === 0" class="loading-state">
        <p>Consultando condiciones de stock actual...</p>
      </div>

      <!-- Estado vacío -->
      <div *ngIf="!cargando() && avisos().length === 0" class="empty-state card-cupertino">
        <span class="material-symbols-rounded icon-grande">inventory</span>
        <p>No se encontraron insumos registrados en el inventario.</p>
      </div>

      <!-- Lista de Avisos (Una sola fila por ingrediente - Criterio CW-09) -->
      <div class="avisos-list" *ngIf="avisos().length > 0">
        <div
          *ngFor="let aviso of avisos(); trackBy: trackPorId"
          class="card-cupertino aviso-item"
          [class.borde-rojo]="aviso.estadoStock === 'AGOTADO'"
          [class.borde-amarillo]="aviso.estadoStock === 'BAJO_STOCK'"
          [class.borde-verde]="aviso.estadoStock === 'NORMAL'">

          <div
            class="aviso-icon-wrapper"
            [class.bg-rojo]="aviso.estadoStock === 'AGOTADO'"
            [class.bg-amarillo]="aviso.estadoStock === 'BAJO_STOCK'"
            [class.bg-verde]="aviso.estadoStock === 'NORMAL'">
            <span class="material-symbols-rounded">
              {{ aviso.estadoStock === 'AGOTADO' ? 'error' : aviso.estadoStock === 'BAJO_STOCK' ? 'warning' : 'check_circle' }}
            </span>
          </div>

          <div class="aviso-details">
            <h4>{{ aviso.nombre }}</h4>
            <p class="stock-info">
              Existencia actual: <strong>{{ aviso.existencia }} {{ aviso.unidad }}</strong>
              <span class="separador">|</span>
              Mínimo obligatorio: <strong>{{ aviso.minimo }} {{ aviso.unidad }}</strong>
            </p>
          </div>

          <div class="aviso-badge">
            <span *ngIf="aviso.estadoStock === 'AGOTADO'" class="badge badge-rojo">AGOTADO</span>
            <span *ngIf="aviso.estadoStock === 'BAJO_STOCK'" class="badge badge-amarillo">BAJO STOCK</span>
            <span *ngIf="aviso.estadoStock === 'NORMAL'" class="badge badge-verde">NORMAL</span>
          </div>
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
    .icono-rotando {
      animation: rotar 1s linear infinite;
    }
    @keyframes rotar {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
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
      min-width: 0;
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
    .separador {
      margin: 0 4px;
      color: var(--color-borde);
    }
    .aviso-badge {
      flex-shrink: 0;
    }

    .loading-state, .empty-state {
      text-align: center;
      padding: 32px 16px;
      color: var(--color-texto-secundario);
    }
    .icon-grande {
      font-size: 48px;
      margin-bottom: 8px;
      color: #a1a1aa;
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
export class AvisosComponent implements OnInit, OnDestroy {
  private api = inject(InventarioApiService);
  authService = inject(AuthService);

  avisos = signal<AvisoStockDTO[]>([]);
  cargando = signal<boolean>(false);

  private listenerVisibilidad: (() => void) | null = null;
  private listenerFoco: (() => void) | null = null;

  ngOnInit(): void {
    this.recargarAvisos();

    // Criterio CW-09: Al volver a la pestaña o ventana se consulta el estado vigente
    this.listenerVisibilidad = () => {
      if (document.visibilityState === 'visible') {
        this.recargarAvisos();
      }
    };
    this.listenerFoco = () => {
      this.recargarAvisos();
    };

    document.addEventListener('visibilitychange', this.listenerVisibilidad);
    window.addEventListener('focus', this.listenerFoco);
  }

  ngOnDestroy(): void {
    if (this.listenerVisibilidad) {
      document.removeEventListener('visibilitychange', this.listenerVisibilidad);
    }
    if (this.listenerFoco) {
      window.removeEventListener('focus', this.listenerFoco);
    }
  }

  recargarAvisos(): void {
    this.cargando.set(true);
    this.api.obtenerAvisos().subscribe({
      next: (datos) => {
        this.avisos.set(datos);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al consultar avisos de inventario:', err);
        this.cargando.set(false);
      }
    });
  }

  trackPorId(_index: number, aviso: AvisoStockDTO): number {
    return aviso.ingredienteId;
  }
}
