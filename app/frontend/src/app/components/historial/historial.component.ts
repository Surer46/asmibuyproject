import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import {
  VentasApiService,
  OrdenDTO,
  ResumenPeriodoVentasDTO
} from '../../services/ventas.service';

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="app-container">
      <!-- Encabezado -->
      <div class="view-header">
        <div>
          <h2>Historial de Ventas</h2>
          <p class="subtitle">
            {{ authService.esAdmin() ? 'Consultando todas las órdenes de la sucursal' : 'Consultando exclusivamente tus órdenes del turno' }}
          </p>
        </div>
        <button (click)="cargarHistorial()" class="btn-cupertino btn-secundario btn-sm" [disabled]="cargando()">
          <span class="material-symbols-rounded" [class.icono-rotando]="cargando()">refresh</span>
          <span>{{ cargando() ? 'Consultando...' : 'Actualizar' }}</span>
        </button>
      </div>

      <!-- Notificaciones -->
      <div *ngIf="mensajeExito()" class="notificacion notif-exito">
        <span class="material-symbols-rounded">check_circle</span>
        <span>{{ mensajeExito() }}</span>
      </div>

      <div *ngIf="mensajeError()" class="notificacion notif-error">
        <span class="material-symbols-rounded">error</span>
        <span>{{ mensajeError() }}</span>
      </div>

      <!-- Tarjetas de Resumen del Periodo (W4-04 / CW-16) -->
      <div class="resumen-grid" *ngIf="resumen()">
        <div class="card-cupertino metric-card">
          <div class="metric-icon-box bg-verde-suave">
            <span class="material-symbols-rounded text-verde">payments</span>
          </div>
          <div class="metric-content">
            <span class="metric-label">Total Vigente del Periodo</span>
            <span class="metric-value">\${{ resumen()!.totalVentasConfirmadas }}</span>
            <small class="metric-nota">Solo ventas confirmadas (excluye anuladas)</small>
          </div>
        </div>

        <div class="card-cupertino metric-card">
          <div class="metric-icon-box bg-azul-suave">
            <span class="material-symbols-rounded text-azul">receipt</span>
          </div>
          <div class="metric-content">
            <span class="metric-label">Órdenes Confirmadas</span>
            <span class="metric-value">{{ resumen()!.cantidadConfirmadas }}</span>
            <small class="metric-nota">Transacciones completadas</small>
          </div>
        </div>

        <div class="card-cupertino metric-card">
          <div class="metric-icon-box bg-rojo-suave">
            <span class="material-symbols-rounded text-rojo">cancel</span>
          </div>
          <div class="metric-content">
            <span class="metric-label">Órdenes Anuladas</span>
            <span class="metric-value">{{ resumen()!.cantidadAnuladas }}</span>
            <small class="metric-nota">Insumos no reintegrados</small>
          </div>
        </div>
      </div>

      <!-- Filtros por Fecha -->
      <div class="card-cupertino filtros-card">
        <div class="filtros-row">
          <div class="filtro-campo">
            <label for="fechaInicio">Fecha Inicio:</label>
            <input
              id="fechaInicio"
              type="date"
              [(ngModel)]="fechaInicio"
              class="input-fecha"
            />
          </div>
          <div class="filtro-campo">
            <label for="fechaFin">Fecha Fin:</label>
            <input
              id="fechaFin"
              type="date"
              [(ngModel)]="fechaFin"
              class="input-fecha"
            />
          </div>
          <div class="filtros-acciones">
            <button (click)="cargarHistorial()" class="btn-cupertino btn-primario btn-sm" [disabled]="cargando()">
              Filtrar
            </button>
            <button *ngIf="fechaInicio || fechaFin" (click)="limpiarFiltros()" class="btn-cupertino btn-secundario btn-sm">
              Limpiar
            </button>
          </div>
        </div>
      </div>

      <!-- Estado de Carga -->
      <div *ngIf="cargando()" class="loading-state card-cupertino">
        <span class="material-symbols-rounded icono-rotando">refresh</span>
        <p>Cargando órdenes del periodo...</p>
      </div>

      <!-- Estado Vacío -->
      <div *ngIf="!cargando() && (!resumen() || resumen()!.ordenes.length === 0)" class="empty-state card-cupertino">
        <span class="material-symbols-rounded icon-grande">receipt_long</span>
        <p>No se encontraron órdenes registradas para el periodo seleccionado.</p>
      </div>

      <!-- Lista de Órdenes del Historial -->
      <div *ngIf="!cargando() && resumen() && resumen()!.ordenes.length > 0" class="ordenes-lista">
        <div
          *ngFor="let orden of resumen()!.ordenes; trackBy: trackPorOrdenId"
          class="card-cupertino orden-card"
          [class.borde-anulada]="orden.estado === 'ANULADA'">
          <div class="orden-cabecera">
            <div class="folio-con-badge">
              <strong>{{ orden.folio }}</strong>
              <span class="badge" [class.badge-verde]="orden.estado === 'CONFIRMADA'" [class.badge-rojo]="orden.estado === 'ANULADA'">
                {{ orden.estado }}
              </span>
            </div>
            <div class="orden-total-tag">
              <span class="total-monto" [class.texto-tachado]="orden.estado === 'ANULADA'">
                \${{ orden.total }}
              </span>
            </div>
          </div>

          <div class="orden-detalles-meta">
            <div class="meta-dato">
              <span class="material-symbols-rounded">calendar_today</span>
              <span>{{ formatearFecha(orden.creadoEn) }}</span>
            </div>
            <div class="meta-dato">
              <span class="material-symbols-rounded">person</span>
              <span>Cajero: {{ orden.nombreCajero }}</span>
            </div>
            <div class="meta-dato">
              <span class="material-symbols-rounded">payments</span>
              <span>Método: {{ orden.metodoPago }}</span>
            </div>
            <div *ngIf="orden.promocion?.nombre" class="meta-dato">
              <span class="material-symbols-rounded text-morado">local_offer</span>
              <span class="text-morado">Promo: {{ orden.promocion?.nombre }}</span>
            </div>
          </div>

          <!-- Información de Anulación (CW-16) -->
          <div *ngIf="orden.estado === 'ANULADA'" class="aviso-anulacion">
            <div class="anulacion-header">
              <span class="material-symbols-rounded">info</span>
              <span>Anulada por {{ orden.nombreUsuarioAnulacion || 'Administrador' }} el {{ formatearFecha(orden.anuladoEn || '') }}</span>
            </div>
            <p class="anulacion-motivo"><strong>Motivo:</strong> "{{ orden.motivoAnulacion }}"</p>
          </div>

          <!-- Acciones de la Orden -->
          <div class="orden-acciones">
            <button (click)="verDetalle(orden)" class="btn-cupertino btn-sm btn-secundario">
              <span class="material-symbols-rounded">visibility</span>
              <span>Ver Comprobante</span>
            </button>

            <!-- Solo Administrador puede anular ventas confirmadas (CW-02 / CW-16) -->
            <button
              *ngIf="authService.esAdmin() && orden.estado === 'CONFIRMADA'"
              (click)="abrirModalAnulacion(orden)"
              class="btn-cupertino btn-sm btn-rojo">
              <span class="material-symbols-rounded">cancel</span>
              <span>Anular Venta</span>
            </button>
          </div>
        </div>
      </div>

      <!-- MODAL DE COMPROBANTE HISTÓRICO (CW-15 / W4-04) -->
      <div *ngIf="modalComprobanteVisible() && ordenSeleccionada()" class="modal-backdrop">
        <div class="card-cupertino modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-comprobante-titulo">
          <div class="comprobante-header">
            <div class="icono-comprobante" [class.bg-rojo-suave]="ordenSeleccionada()!.estado === 'ANULADA'">
              <span class="material-symbols-rounded" [class.text-rojo]="ordenSeleccionada()!.estado === 'ANULADA'">
                {{ ordenSeleccionada()!.estado === 'ANULADA' ? 'cancel' : 'receipt' }}
              </span>
            </div>
            <h3 id="modal-comprobante-titulo">Comprobante de Venta</h3>
            <div class="folio-badge">
              <span>Folio:</span>
              <strong>{{ ordenSeleccionada()!.folio }}</strong>
              <span class="badge" [class.badge-verde]="ordenSeleccionada()!.estado === 'CONFIRMADA'" [class.badge-rojo]="ordenSeleccionada()!.estado === 'ANULADA'">
                {{ ordenSeleccionada()!.estado }}
              </span>
            </div>
          </div>

          <div class="comprobante-cuerpo">
            <div class="datos-meta">
              <div class="meta-item">
                <span class="meta-label">Fecha y Hora:</span>
                <span class="meta-valor">{{ formatearFecha(ordenSeleccionada()!.creadoEn) }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Cajero:</span>
                <span class="meta-valor">{{ ordenSeleccionada()!.nombreCajero }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Método de Pago:</span>
                <span class="meta-valor">{{ ordenSeleccionada()!.metodoPago }}</span>
              </div>
            </div>

            <!-- Tabla de Partidas Inmutables (CW-15) -->
            <div class="partidas-tabla-container">
              <table class="partidas-tabla">
                <thead>
                  <tr>
                    <th>Platillo</th>
                    <th class="col-center">Cant.</th>
                    <th class="col-right">P. Unit.</th>
                    <th class="col-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let partida of ordenSeleccionada()!.partidas">
                    <td>
                      <div class="nombre-platillo-comprobante">{{ partida.nombrePlatillo }}</div>
                      <small *ngIf="partida.unidadesBonificadas > 0" class="bonificado-tag">
                        ({{ partida.unidadesCobradas }} cobradas + {{ partida.unidadesBonificadas }} bonificadas)
                      </small>
                    </td>
                    <td class="col-center">{{ partida.cantidad }}</td>
                    <td class="col-right">\${{ partida.precioUnitario }}</td>
                    <td class="col-right">\${{ partida.subtotalNeto }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Totales -->
            <div class="totales-comprobante">
              <div class="fila-total-comprobante">
                <span>Subtotal Bruto:</span>
                <span>\${{ ordenSeleccionada()!.subtotalBruto }}</span>
              </div>
              <div *ngIf="ordenSeleccionada()!.descuentoTotal !== '0.00'" class="fila-total-comprobante fila-ahorro">
                <span>Descuento ({{ ordenSeleccionada()!.promocion?.nombre || 'Promoción' }}):</span>
                <span>-\${{ ordenSeleccionada()!.descuentoTotal }}</span>
              </div>
              <div class="fila-total-comprobante gran-total">
                <strong>Total:</strong>
                <strong>\${{ ordenSeleccionada()!.total }}</strong>
              </div>
            </div>

            <!-- Aviso si la orden está anulada -->
            <div *ngIf="ordenSeleccionada()!.estado === 'ANULADA'" class="aviso-anulacion modal-aviso-anulacion">
              <span class="material-symbols-rounded">error</span>
              <div>
                <strong>Orden Anulada:</strong>
                <p>Motivo: "{{ ordenSeleccionada()!.motivoAnulacion }}"</p>
                <small>Autorizada por {{ ordenSeleccionada()!.nombreUsuarioAnulacion }} el {{ formatearFecha(ordenSeleccionada()!.anuladoEn || '') }}</small>
              </div>
            </div>
          </div>

          <div class="modal-acciones">
            <button (click)="cerrarModalComprobante()" class="btn-cupertino btn-secundario">
              Cerrar
            </button>
          </div>
        </div>
      </div>

      <!-- MODAL DE ANULACIÓN DE VENTA (CW-02 / CW-16 / W4-05) -->
      <div *ngIf="modalAnulacionVisible() && ordenAAnular()" class="modal-backdrop">
        <div class="card-cupertino modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-anulacion-titulo">
          <div class="anulacion-modal-header">
            <div class="icono-alerta-rojo">
              <span class="material-symbols-rounded">warning</span>
            </div>
            <h3 id="modal-anulacion-titulo">Anular Orden {{ ordenAAnular()!.folio }}</h3>
            <p class="advertencia-texto">
              Esta acción marcará la orden como ANULADA y la excluirá del total vigente del periodo.
              <strong>No se realizará reintegro automático de inventario</strong> (si los insumos se recuperaron físicamente, registra un ajuste positivo justificado en Gestión).
            </p>
          </div>

          <div class="form-grupo">
            <label for="motivoAnulacion" class="form-label">Motivo obligatorio de anulación (*):</label>
            <textarea
              id="motivoAnulacion"
              [(ngModel)]="motivoAnulacion"
              class="form-textarea"
              rows="3"
              placeholder="Describe detalladamente el motivo de la anulación (ej. error de captura del cajero, cliente desistió de la compra, etc.)"
            ></textarea>
          </div>

          <div class="modal-acciones">
            <button (click)="procesarAnulacion()" class="btn-cupertino btn-rojo" [disabled]="anulando() || !motivoAnulacion.trim()">
              <span class="material-symbols-rounded" [class.icono-rotando]="anulando()">
                {{ anulando() ? 'sync' : 'delete_forever' }}
              </span>
              <span>{{ anulando() ? 'Anulando...' : 'Confirmar Anulación' }}</span>
            </button>
            <button (click)="cerrarModalAnulacion()" class="btn-cupertino btn-secundario" [disabled]="anulando()">
              Cancelar
            </button>
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
      flex-wrap: wrap;
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
    .btn-sm {
      min-height: 38px;
      padding: 6px 14px;
      font-size: 0.85rem;
      border-radius: 10px;
    }

    .notificacion {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-radius: var(--radio-borde);
      margin-bottom: 16px;
      font-size: 0.9rem;
      font-weight: 500;
    }
    .notif-exito {
      background: var(--token-verde-fondo);
      color: var(--token-verde-oscuro);
      border: 1px solid var(--token-verde-borde);
    }
    .notif-error {
      background: var(--token-rojo-fondo);
      color: var(--token-rojo-alerta);
      border: 1px solid var(--token-rojo-borde);
    }

    /* Grid de Métricas */
    .resumen-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }
    @media (min-width: 650px) {
      .resumen-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }
    .metric-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px;
      margin-bottom: 0;
    }
    .metric-icon-box {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .metric-icon-box span {
      font-size: 26px;
    }
    .bg-verde-suave { background: var(--token-verde-fondo); }
    .bg-azul-suave { background: #eff6ff; }
    .bg-rojo-suave { background: var(--token-rojo-fondo); }
    .text-verde { color: var(--token-verde-oscuro); }
    .text-azul { color: #2563eb; }
    .text-rojo { color: var(--token-rojo-alerta); }
    .text-morado { color: var(--token-morado); }

    .metric-content {
      display: flex;
      flex-direction: column;
    }
    .metric-label {
      font-size: 0.78rem;
      color: var(--color-texto-secundario);
      font-weight: 500;
    }
    .metric-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--color-texto);
      line-height: 1.2;
      margin: 2px 0;
    }
    .metric-nota {
      font-size: 0.7rem;
      color: var(--color-texto-secundario);
    }

    /* Filtros */
    .filtros-card {
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    .filtros-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-end;
    }
    .filtro-campo {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      min-width: 140px;
    }
    .filtro-campo label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--color-texto);
    }
    .input-fecha {
      min-height: 40px;
      padding: 6px 10px;
      border-radius: 10px;
      border: 1px solid var(--color-borde);
      background: #ffffff;
      font-family: inherit;
      font-size: 0.88rem;
    }
    .filtros-acciones {
      display: flex;
      gap: 8px;
    }

    /* Órdenes */
    .ordenes-lista {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .orden-card {
      margin-bottom: 0;
      border-left: 4px solid var(--token-verde-confirmar);
      transition: box-shadow 0.15s ease;
    }
    .orden-card.borde-anulada {
      border-left-color: var(--token-rojo-alerta);
      background: #fafaf9;
    }
    .orden-cabecera {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .folio-con-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 1.05rem;
    }
    .total-monto {
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--token-verde-oscuro);
    }
    .texto-tachado {
      text-decoration: line-through;
      color: var(--token-rojo-alerta);
    }

    .orden-detalles-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 18px;
      font-size: 0.82rem;
      color: var(--color-texto-secundario);
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--color-borde);
    }
    .meta-dato {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .meta-dato span.material-symbols-rounded {
      font-size: 16px;
    }

    .aviso-anulacion {
      background: var(--token-rojo-fondo);
      border: 1px solid var(--token-rojo-borde);
      border-radius: 10px;
      padding: 8px 12px;
      margin-bottom: 12px;
      font-size: 0.82rem;
    }
    .anulacion-header {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--token-rojo-alerta);
      font-weight: 600;
      margin-bottom: 4px;
    }
    .anulacion-motivo {
      color: #7f1d1d;
      margin: 0;
    }

    .orden-acciones {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    /* Modales */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
    }
    .modal-box {
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      overflow-y: auto;
      margin-bottom: 0;
    }
    .comprobante-header, .anulacion-modal-header {
      text-align: center;
      margin-bottom: 16px;
    }
    .icono-comprobante, .icono-alerta-rojo {
      width: 50px;
      height: 50px;
      margin: 0 auto 10px auto;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icono-comprobante {
      background: var(--token-verde-fondo);
      color: var(--token-verde-oscuro);
    }
    .icono-alerta-rojo {
      background: var(--token-rojo-fondo);
      color: var(--token-rojo-alerta);
    }
    .icono-comprobante span, .icono-alerta-rojo span {
      font-size: 30px;
    }
    .folio-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #f5f5f4;
      padding: 4px 12px;
      border-radius: 14px;
      font-size: 0.9rem;
      margin-top: 6px;
    }

    .datos-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding: 10px 12px;
      background: #fafaf9;
      border-radius: 12px;
      margin-bottom: 14px;
      font-size: 0.82rem;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .meta-label {
      color: var(--color-texto-secundario);
    }
    .meta-valor {
      font-weight: 600;
      color: var(--color-texto);
    }

    .partidas-tabla-container {
      margin-bottom: 14px;
      border: 1px solid var(--color-borde);
      border-radius: 10px;
      overflow: hidden;
    }
    .partidas-tabla {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    .partidas-tabla th, .partidas-tabla td {
      padding: 8px 10px;
      border-bottom: 1px solid var(--color-borde);
    }
    .partidas-tabla th {
      background: #f5f5f4;
      font-weight: 600;
      text-align: left;
    }
    .col-center { text-align: center; }
    .col-right { text-align: right; }
    .nombre-platillo-comprobante { font-weight: 600; }
    .bonificado-tag {
      display: block;
      color: var(--token-verde-oscuro);
      font-size: 0.72rem;
    }

    .totales-comprobante {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px;
      background: #fafaf9;
      border-radius: 12px;
      margin-bottom: 16px;
      font-size: 0.9rem;
    }
    .fila-total-comprobante {
      display: flex;
      justify-content: space-between;
    }
    .fila-ahorro {
      color: var(--token-morado);
      font-weight: 600;
    }
    .gran-total {
      font-size: 1.15rem;
      border-top: 1px solid var(--color-borde);
      padding-top: 6px;
      margin-top: 4px;
      color: var(--token-verde-oscuro);
    }

    .modal-aviso-anulacion {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      margin-top: 10px;
    }

    .advertencia-texto {
      font-size: 0.82rem;
      color: var(--color-texto-secundario);
      line-height: 1.35;
      margin-top: 6px;
    }
    .advertencia-texto strong {
      color: var(--token-rojo-alerta);
    }

    .form-grupo {
      margin-bottom: 16px;
    }
    .form-label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .form-textarea {
      width: 100%;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid var(--color-borde);
      font-family: inherit;
      font-size: 0.88rem;
    }
    .form-textarea:focus {
      outline: 2px solid var(--token-rojo-alerta);
    }

    .modal-acciones {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }

    /* Utilidades */
    .icono-rotando {
      animation: rotar 1s linear infinite;
    }
    @keyframes rotar {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .loading-state, .empty-state {
      text-align: center;
      padding: 32px 16px;
      color: var(--color-texto-secundario);
    }
    .icon-grande {
      font-size: 40px;
      color: #d6d3d1;
      margin-bottom: 8px;
    }
  `]
})
export class HistorialComponent implements OnInit {
  authService = inject(AuthService);
  private ventasService = inject(VentasApiService);

  resumen = signal<ResumenPeriodoVentasDTO | null>(null);
  cargando = signal<boolean>(false);
  mensajeExito = signal<string>('');
  mensajeError = signal<string>('');

  fechaInicio = '';
  fechaFin = '';

  // Modal Comprobante
  modalComprobanteVisible = signal<boolean>(false);
  ordenSeleccionada = signal<OrdenDTO | null>(null);

  // Modal Anulación (Admin)
  modalAnulacionVisible = signal<boolean>(false);
  ordenAAnular = signal<OrdenDTO | null>(null);
  motivoAnulacion = '';
  anulando = signal<boolean>(false);

  ngOnInit(): void {
    this.cargarHistorial();
  }

  cargarHistorial(): void {
    this.limpiarMensajes();
    this.cargando.set(true);

    const filtro: { fechaInicio?: string; fechaFin?: string } = {};
    if (this.fechaInicio) filtro.fechaInicio = this.fechaInicio;
    if (this.fechaFin) filtro.fechaFin = this.fechaFin;

    this.ventasService.listarHistorial(filtro).subscribe({
      next: (data) => {
        this.resumen.set(data);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.mensajeError.set(err.error?.mensaje || 'Error al consultar el historial de órdenes.');
      }
    });
  }

  limpiarFiltros(): void {
    this.fechaInicio = '';
    this.fechaFin = '';
    this.cargarHistorial();
  }

  verDetalle(orden: OrdenDTO): void {
    this.ordenSeleccionada.set(orden);
    this.modalComprobanteVisible.set(true);
  }

  cerrarModalComprobante(): void {
    this.modalComprobanteVisible.set(false);
    this.ordenSeleccionada.set(null);
  }

  abrirModalAnulacion(orden: OrdenDTO): void {
    this.ordenAAnular.set(orden);
    this.motivoAnulacion = '';
    this.modalAnulacionVisible.set(true);
  }

  cerrarModalAnulacion(): void {
    this.modalAnulacionVisible.set(false);
    this.ordenAAnular.set(null);
    this.motivoAnulacion = '';
  }

  procesarAnulacion(): void {
    const orden = this.ordenAAnular();
    const motivo = this.motivoAnulacion.trim();

    if (!orden || !motivo) return;

    this.anulando.set(true);
    this.ventasService.anularVenta(orden.id, motivo).subscribe({
      next: (ordenActualizada) => {
        this.anulando.set(false);
        this.cerrarModalAnulacion();
        this.mensajeExito.set(`Orden ${ordenActualizada.folio} anulada exitosamente.`);
        this.cargarHistorial();
      },
      error: (err) => {
        this.anulando.set(false);
        this.mensajeError.set(err.error?.mensaje || 'Error al procesar la anulación de la orden.');
      }
    });
  }

  formatearFecha(fechaIso: string): string {
    if (!fechaIso) return '';
    try {
      const d = new Date(fechaIso);
      return d.toLocaleString('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch {
      return fechaIso;
    }
  }

  private limpiarMensajes(): void {
    this.mensajeExito.set('');
    this.mensajeError.set('');
  }

  trackPorOrdenId(_index: number, orden: OrdenDTO): number {
    return orden.id;
  }
}
