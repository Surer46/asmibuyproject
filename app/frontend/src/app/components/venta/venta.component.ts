import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { InventarioApiService, PlatilloDTO } from '../../services/inventario.service';
import {
  PromocionesApiService,
  ResultadoCotizacionDTO,
  ItemCotizacionInput
} from '../../services/promociones.service';
import {
  VentasApiService,
  OrdenDTO,
  MetodoPago,
  ConfirmarVentaInput
} from '../../services/ventas.service';

export interface ItemCarrito {
  platillo: PlatilloDTO;
  cantidad: number;
}

@Component({
  selector: 'app-venta',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="app-container">
      <!-- Encabezado de la Pantalla -->
      <div class="view-header">
        <div>
          <h2>Punto de Venta</h2>
          <p class="subtitle">Selección de platillos, carrito dinámico y confirmación transaccional</p>
        </div>
        <div class="user-chip">
          <span class="material-symbols-rounded">account_circle</span>
          <span>{{ authService.usuarioActual()?.nombre }} ({{ authService.usuarioActual()?.perfil }})</span>
        </div>
      </div>

      <!-- Banner de Recuperación de Venta en Vuelo (CW-19) -->
      <div *ngIf="ventaPendienteClave()" class="banner-aviso banner-recuperacion card-cupertino">
        <div class="banner-contenido">
          <span class="material-symbols-rounded icon-aviso">sync_problem</span>
          <div>
            <strong>Transacción en vuelo detectada</strong>
            <p>Se detectó una confirmación pendiente en este navegador tras una posible desconexión. Puedes verificar su resultado sin duplicar consumos.</p>
          </div>
        </div>
        <div class="banner-acciones">
          <button (click)="verificarVentaPendiente()" class="btn-cupertino btn-sm btn-naranja" [disabled]="recuperando()">
            <span class="material-symbols-rounded" [class.icono-rotando]="recuperando()">refresh</span>
            <span>{{ recuperando() ? 'Verificando...' : 'Verificar Estado' }}</span>
          </button>
          <button (click)="descartarVentaPendiente()" class="btn-cupertino btn-sm btn-secundario" [disabled]="recuperando()">
            Descartar
          </button>
        </div>
      </div>

      <!-- Notificaciones de Alerta / Error / Éxito -->
      <div *ngIf="mensajeExito()" class="notificacion notif-exito">
        <span class="material-symbols-rounded">check_circle</span>
        <span>{{ mensajeExito() }}</span>
      </div>

      <div *ngIf="mensajeAlerta()" class="notificacion notif-alerta">
        <span class="material-symbols-rounded">warning</span>
        <span>{{ mensajeAlerta() }}</span>
      </div>

      <div *ngIf="mensajeError()" class="notificacion notif-error">
        <span class="material-symbols-rounded">error</span>
        <span>{{ mensajeError() }}</span>
      </div>

      <!-- Distribución Principal: Catálogo (Izquierda) y Carrito/Cobro (Derecha) -->
      <div class="pos-layout">
        <!-- SECCIÓN 1: CATÁLOGO DE PLATILLOS -->
        <section class="catalogo-section">
          <div class="catalogo-header">
            <h3>Catálogo de Platillos</h3>
            <span class="badge badge-verde">{{ platillosFiltrados().length }} disponibles</span>
          </div>

          <!-- Barra de Búsqueda de Platillos -->
          <div class="busqueda-container">
            <span class="material-symbols-rounded busqueda-icon">search</span>
            <input
              type="text"
              [(ngModel)]="filtroTexto"
              placeholder="Buscar platillo por nombre..."
              class="busqueda-input"
              aria-label="Buscar platillo"
            />
            <button *ngIf="filtroTexto" (click)="filtroTexto = ''" class="btn-limpiar" aria-label="Limpiar búsqueda">
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>

          <!-- Estado de Carga -->
          <div *ngIf="cargandoCatalogo()" class="loading-state card-cupertino">
            <span class="material-symbols-rounded icono-rotando">refresh</span>
            <p>Cargando menú de platillos disponibles...</p>
          </div>

          <!-- Estado Vacío -->
          <div *ngIf="!cargandoCatalogo() && platillosFiltrados().length === 0" class="empty-state card-cupertino">
            <span class="material-symbols-rounded icon-grande">restaurant_menu</span>
            <p *ngIf="filtroTexto">No se encontraron platillos que coincidan con "{{ filtroTexto }}".</p>
            <p *ngIf="!filtroTexto">No hay platillos activos con receta válida en el catálogo.</p>
          </div>

          <!-- Cuadrícula / Lista de Platillos -->
          <div class="platillos-grid" *ngIf="!cargandoCatalogo() && platillosFiltrados().length > 0">
            <div
              *ngFor="let platillo of platillosFiltrados(); trackBy: trackPorPlatilloId"
              class="card-cupertino platillo-card"
              [class.en-carrito]="estaEnCarrito(platillo.id)">
              <div class="platillo-info">
                <div class="platillo-titulo-row">
                  <h4>{{ platillo.nombre }}</h4>
                  <span *ngIf="obtenerCantidadEnCarrito(platillo.id) > 0" class="badge-cantidad">
                    {{ obtenerCantidadEnCarrito(platillo.id) }} en carrito
                  </span>
                </div>
                <div class="platillo-precio-row">
                  <span class="precio-tag">\${{ platillo.precio }}</span>
                </div>
              </div>

              <button
                (click)="agregarAlCarrito(platillo)"
                class="btn-cupertino btn-naranja btn-agregar"
                [attr.aria-label]="'Agregar ' + platillo.nombre + ' al carrito'">
                <span class="material-symbols-rounded">add_shopping_cart</span>
                <span>Agregar</span>
              </button>
            </div>
          </div>
        </section>

        <!-- SECCIÓN 2: CARRITO, COTIZACIÓN Y CONFIRMACIÓN -->
        <section class="carrito-section">
          <div class="card-cupertino carrito-card">
            <div class="carrito-header">
              <div class="titulo-con-icono">
                <span class="material-symbols-rounded">shopping_cart</span>
                <h3>Carrito de Venta</h3>
              </div>
              <button
                *ngIf="carrito().length > 0"
                (click)="vaciarCarrito()"
                class="btn-limpiar-carrito"
                title="Vaciar carrito"
                aria-label="Vaciar carrito">
                <span class="material-symbols-rounded">delete_sweep</span>
                <span>Vaciar</span>
              </button>
            </div>

            <!-- Carrito Vacío -->
            <div *ngIf="carrito().length === 0" class="carrito-vacio">
              <span class="material-symbols-rounded icon-carrito-vacio">shopping_basket</span>
              <p class="texto-vacio-primario">El carrito está vacío</p>
              <p class="texto-vacio-secundario">Toca "Agregar" en los platillos del catálogo para armar la orden.</p>
            </div>

            <!-- Lista de Partidas en el Carrito -->
            <div *ngIf="carrito().length > 0" class="items-carrito-lista">
              <div
                *ngFor="let item of carrito(); trackBy: trackPorItemPlatilloId"
                class="item-carrito-row">
                <div class="item-descripcion">
                  <strong class="item-nombre">{{ item.platillo.nombre }}</strong>
                  <span class="item-precio-unitario">\${{ item.platillo.precio }} c/u</span>
                </div>

                <!-- Controles de Cantidad (+ / -) con Mínimo 44px de Área Táctil -->
                <div class="controles-cantidad">
                  <button
                    (click)="decrementarCantidad(item)"
                    class="btn-cantidad"
                    [attr.aria-label]="'Restar uno a ' + item.platillo.nombre">
                    <span class="material-symbols-rounded">{{ item.cantidad === 1 ? 'delete' : 'remove' }}</span>
                  </button>
                  <span class="cantidad-numero" aria-live="polite">{{ item.cantidad }}</span>
                  <button
                    (click)="incrementarCantidad(item)"
                    class="btn-cantidad"
                    [attr.aria-label]="'Sumar uno a ' + item.platillo.nombre">
                    <span class="material-symbols-rounded">add</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Desglose de Cotización en Tiempo Real -->
            <div *ngIf="carrito().length > 0" class="resumen-cotizacion">
              <!-- Indicador de Cálculo de Cotización -->
              <div *ngIf="cotizando()" class="cotizando-indicator">
                <span class="material-symbols-rounded icono-rotando">sync</span>
                <span>Calculando promociones y cotización...</span>
              </div>

              <div *ngIf="cotizacion()" class="desglose-filas">
                <div class="fila-resumen">
                  <span class="label">Subtotal bruto:</span>
                  <span class="valor">\${{ cotizacion()!.subtotalBruto }}</span>
                </div>

                <!-- Detalle de Promoción Aplicada (CW-11 / CW-12 / CW-13) -->
                <div *ngIf="tieneDescuento()" class="fila-resumen fila-descuento">
                  <div class="descuento-info">
                    <span class="label">Descuento aplicado:</span>
                    <span class="badge badge-morado promo-tag" *ngIf="cotizacion()!.promocionAplicada">
                      <span class="material-symbols-rounded">local_offer</span>
                      {{ cotizacion()!.promocionAplicada!.nombre }}
                    </span>
                  </div>
                  <span class="valor valor-descuento">-\${{ cotizacion()!.descuentoTotal }}</span>
                </div>

                <!-- Unidades bonificadas en detalle si aplica promoción NxM (CW-12) -->
                <div *ngIf="hayUnidadesBonificadas()" class="bonificadas-aviso">
                  <span class="material-symbols-rounded">card_giftcard</span>
                  <span>Incluye unidades de cortesía por promoción NxM (consumen insumos completos)</span>
                </div>

                <div class="divisor-resumen"></div>

                <div class="fila-resumen fila-total">
                  <span class="label-total">Total a pagar:</span>
                  <span class="valor-total">\${{ cotizacion()!.total }}</span>
                </div>
              </div>

              <!-- Selector de Método de Pago -->
              <div class="metodo-pago-box">
                <label class="metodo-pago-label">Método de Pago:</label>
                <div *ngIf="esTotalCero()" class="metodo-gratuito-aviso">
                  <span class="badge badge-verde">SIN COBRO (Promoción 100%)</span>
                </div>

                <div *ngIf="!esTotalCero()" class="metodos-opciones">
                  <button
                    type="button"
                    class="btn-metodo"
                    [class.seleccionado]="metodoPagoSeleccionado() === 'EFECTIVO'"
                    (click)="metodoPagoSeleccionado.set('EFECTIVO')">
                    <span class="material-symbols-rounded">payments</span>
                    <span>Efectivo</span>
                  </button>
                  <button
                    type="button"
                    class="btn-metodo"
                    [class.seleccionado]="metodoPagoSeleccionado() === 'EXTERNO'"
                    (click)="metodoPagoSeleccionado.set('EXTERNO')">
                    <span class="material-symbols-rounded">credit_card</span>
                    <span>Tarjeta / Externo</span>
                  </button>
                </div>
              </div>

              <!-- Botón de Confirmación Transaccional (W4-03 / CW-07) -->
              <button
                (click)="confirmarVenta()"
                class="btn-cupertino btn-verde btn-confirmar-venta"
                [disabled]="confirmando() || cotizando() || !cotizacion()">
                <span class="material-symbols-rounded" [class.icono-rotando]="confirmando()">
                  {{ confirmando() ? 'sync' : 'check_circle' }}
                </span>
                <span>
                  {{ confirmando() ? 'Procesando venta...' : 'Confirmar Venta (\$' + (cotizacion()?.total || '0.00') + ')' }}
                </span>
              </button>

              <p class="seguridad-aviso">
                <span class="material-symbols-rounded">verified_user</span>
                <span>Transacción atómica: existencia revalidada en servidor e idempotencia protegida.</span>
              </p>
            </div>
          </div>
        </section>
      </div>

      <!-- MODAL DE COMPROBANTE EN PANTALLA (CW-15 / W4-03 / W4-04) -->
      <div *ngIf="comprobanteVisible() && ordenComprobante()" class="modal-backdrop">
        <div class="card-cupertino modal-comprobante" role="dialog" aria-modal="true" aria-labelledby="modal-comprobante-titulo">
          <div class="comprobante-header">
            <div class="icono-exito">
              <span class="material-symbols-rounded">task_alt</span>
            </div>
            <h3 id="modal-comprobante-titulo">¡Venta Confirmada con Éxito!</h3>
            <div class="folio-badge">
              <span>Folio:</span>
              <strong>{{ ordenComprobante()!.folio }}</strong>
            </div>
          </div>

          <div class="comprobante-cuerpo">
            <div class="datos-meta">
              <div class="meta-item">
                <span class="meta-label">Fecha y Hora:</span>
                <span class="meta-valor">{{ formatearFecha(ordenComprobante()!.creadoEn) }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Cajero:</span>
                <span class="meta-valor">{{ ordenComprobante()!.nombreCajero }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Método de Pago:</span>
                <span class="meta-valor">{{ ordenComprobante()!.metodoPago }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Estado:</span>
                <span class="badge badge-verde">CONFIRMADA</span>
              </div>
            </div>

            <!-- Tabla de Partidas -->
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
                  <tr *ngFor="let partida of ordenComprobante()!.partidas">
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

            <!-- Totales del Comprobante -->
            <div class="totales-comprobante">
              <div class="fila-total-comprobante">
                <span>Subtotal Bruto:</span>
                <span>\${{ ordenComprobante()!.subtotalBruto }}</span>
              </div>
              <div *ngIf="ordenComprobante()!.descuentoTotal !== '0.00'" class="fila-total-comprobante fila-ahorro">
                <span>Descuento ({{ ordenComprobante()!.promocion?.nombre || 'Promoción' }}):</span>
                <span>-\${{ ordenComprobante()!.descuentoTotal }}</span>
              </div>
              <div class="fila-total-comprobante gran-total">
                <strong>Total Pagado:</strong>
                <strong>\${{ ordenComprobante()!.total }}</strong>
              </div>
            </div>
          </div>

          <div class="comprobante-acciones">
            <button (click)="iniciarNuevaVenta()" class="btn-cupertino btn-naranja btn-nueva-venta">
              <span class="material-symbols-rounded">add_circle</span>
              <span>Nueva Venta</span>
            </button>
            <button (click)="cerrarComprobante()" class="btn-cupertino btn-secundario">
              <span>Cerrar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Layout y Encabezados */
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

    /* Banners y Notificaciones */
    .banner-aviso {
      background: var(--token-amarillo-fondo);
      border: 1px solid var(--token-amarillo-borde);
      padding: 14px 16px;
      margin-bottom: 16px;
    }
    .banner-contenido {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 10px;
    }
    .icon-aviso {
      color: var(--token-amarillo-aviso);
      font-size: 26px;
      flex-shrink: 0;
    }
    .banner-contenido strong {
      font-size: 0.95rem;
      color: var(--token-amarillo-texto);
    }
    .banner-contenido p {
      font-size: 0.85rem;
      color: var(--token-amarillo-texto);
      margin-top: 2px;
      line-height: 1.35;
    }
    .banner-acciones {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
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
    .notif-alerta {
      background: var(--token-amarillo-fondo);
      color: var(--token-amarillo-texto);
      border: 1px solid var(--token-amarillo-borde);
    }
    .notif-error {
      background: var(--token-rojo-fondo);
      color: var(--token-rojo-alerta);
      border: 1px solid var(--token-rojo-borde);
    }

    /* Layout en 2 columnas adaptable */
    .pos-layout {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    @media (min-width: 900px) {
      .pos-layout {
        display: grid;
        grid-template-columns: 1.15fr 0.85fr;
        align-items: start;
        gap: 22px;
      }
    }

    /* Catálogo */
    .catalogo-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .catalogo-header h3 {
      font-size: 1.15rem;
      font-weight: 700;
    }

    .busqueda-container {
      position: relative;
      margin-bottom: 14px;
    }
    .busqueda-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--color-texto-secundario);
      font-size: 20px;
    }
    .busqueda-input {
      width: 100%;
      min-height: 44px;
      padding: 10px 40px;
      border-radius: 12px;
      border: 1px solid var(--color-borde);
      background: #ffffff;
      font-size: 0.95rem;
      font-family: inherit;
    }
    .busqueda-input:focus {
      outline: 2px solid var(--token-naranja-primario);
    }
    .btn-limpiar {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-texto-secundario);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
    }

    .platillos-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }
    @media (min-width: 500px) {
      .platillos-grid {
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      }
    }

    .platillo-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 14px;
      margin-bottom: 0;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .platillo-card.en-carrito {
      border-color: var(--token-naranja-primario);
      box-shadow: 0 0 0 1px var(--token-naranja-primario);
    }
    .platillo-info {
      margin-bottom: 12px;
    }
    .platillo-titulo-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 6px;
    }
    .platillo-titulo-row h4 {
      font-size: 1rem;
      font-weight: 600;
      color: var(--color-texto);
      line-height: 1.25;
    }
    .badge-cantidad {
      align-self: flex-start;
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--token-naranja-oscuro);
      background: var(--token-naranja-fondo);
      border: 1px solid var(--token-naranja-borde);
      padding: 2px 8px;
      border-radius: 12px;
    }
    .precio-tag {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--token-verde-oscuro);
    }
    .btn-agregar {
      width: 100%;
      min-height: 42px;
      padding: 8px 14px;
      font-size: 0.9rem;
      border-radius: 10px;
    }

    /* Carrito */
    .carrito-card {
      position: sticky;
      top: 14px;
    }
    .carrito-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--color-borde);
    }
    .titulo-con-icono {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .titulo-con-icono span {
      color: var(--token-naranja-primario);
      font-size: 22px;
    }
    .titulo-con-icono h3 {
      font-size: 1.1rem;
      font-weight: 700;
    }
    .btn-limpiar-carrito {
      display: flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: none;
      color: var(--token-rojo-alerta);
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      padding: 6px 8px;
      border-radius: 8px;
    }
    .btn-limpiar-carrito:hover {
      background: var(--token-rojo-fondo);
    }

    .carrito-vacio {
      text-align: center;
      padding: 30px 14px;
      color: var(--color-texto-secundario);
    }
    .icon-carrito-vacio {
      font-size: 44px;
      color: #d6d3d1;
      margin-bottom: 8px;
    }
    .texto-vacio-primario {
      font-weight: 600;
      font-size: 0.95rem;
      color: var(--color-texto);
      margin-bottom: 4px;
    }
    .texto-vacio-secundario {
      font-size: 0.82rem;
      line-height: 1.35;
    }

    /* Lista de Items en Carrito */
    .items-carrito-lista {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 280px;
      overflow-y: auto;
      padding-right: 4px;
      margin-bottom: 16px;
    }
    .item-carrito-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      background: #fafaf9;
      border-radius: 12px;
      border: 1px solid var(--color-borde);
    }
    .item-descripcion {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .item-nombre {
      font-size: 0.9rem;
      color: var(--color-texto);
    }
    .item-precio-unitario {
      font-size: 0.8rem;
      color: var(--color-texto-secundario);
    }
    .controles-cantidad {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-cantidad {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      border: 1px solid var(--color-borde);
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.12s;
    }
    .btn-cantidad:active {
      background: #e7e5e4;
      transform: scale(0.94);
    }
    .btn-cantidad span {
      font-size: 18px;
      color: var(--color-texto);
    }
    .cantidad-numero {
      font-weight: 700;
      font-size: 0.95rem;
      min-width: 22px;
      text-align: center;
    }

    /* Resumen de Cotización */
    .resumen-cotizacion {
      border-top: 1px solid var(--color-borde);
      padding-top: 14px;
    }
    .cotizando-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.82rem;
      color: var(--token-naranja-oscuro);
      margin-bottom: 8px;
    }
    .desglose-filas {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 14px;
    }
    .fila-resumen {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.9rem;
    }
    .fila-descuento {
      color: var(--token-morado);
    }
    .descuento-info {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .promo-tag {
      font-size: 0.72rem;
      padding: 2px 8px;
    }
    .valor-descuento {
      font-weight: 700;
    }
    .bonificadas-aviso {
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--token-verde-fondo);
      color: var(--token-verde-oscuro);
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 0.78rem;
      font-weight: 500;
    }
    .bonificadas-aviso span.material-symbols-rounded {
      font-size: 18px;
    }
    .divisor-resumen {
      height: 1px;
      background: var(--color-borde);
      margin: 4px 0;
    }
    .fila-total {
      font-size: 1.15rem;
      font-weight: 700;
    }
    .valor-total {
      color: var(--token-verde-oscuro);
      font-size: 1.3rem;
    }

    /* Método de Pago */
    .metodo-pago-box {
      margin-bottom: 16px;
    }
    .metodo-pago-label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--color-texto);
      margin-bottom: 8px;
    }
    .metodos-opciones {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .btn-metodo {
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid var(--color-borde);
      background: #ffffff;
      font-size: 0.88rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-metodo.seleccionado {
      border-color: var(--token-naranja-primario);
      background: var(--token-naranja-fondo);
      color: var(--token-naranja-oscuro);
      font-weight: 700;
      box-shadow: 0 0 0 1px var(--token-naranja-primario);
    }
    .btn-metodo span.material-symbols-rounded {
      font-size: 20px;
    }

    .btn-confirmar-venta {
      width: 100%;
      min-height: 48px;
      font-size: 1.05rem;
      border-radius: 14px;
    }
    .btn-confirmar-venta:disabled {
      opacity: 0.55;
      cursor: not-allowed;
      transform: none;
    }

    .seguridad-aviso {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 0.75rem;
      color: var(--color-texto-secundario);
      margin-top: 10px;
      text-align: center;
    }
    .seguridad-aviso span.material-symbols-rounded {
      font-size: 16px;
      color: var(--token-verde-oscuro);
    }

    /* Modal de Comprobante */
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
    .modal-comprobante {
      width: 100%;
      max-width: 460px;
      max-height: 90vh;
      overflow-y: auto;
      margin-bottom: 0;
      animation: modalAparecer 0.2s ease-out;
    }
    @keyframes modalAparecer {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    .comprobante-header {
      text-align: center;
      margin-bottom: 16px;
    }
    .icono-exito {
      width: 56px;
      height: 56px;
      margin: 0 auto 10px auto;
      border-radius: 50%;
      background: var(--token-verde-fondo);
      color: var(--token-verde-oscuro);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icono-exito span {
      font-size: 34px;
    }
    .comprobante-header h3 {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .folio-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #f5f5f4;
      padding: 4px 12px;
      border-radius: 14px;
      font-size: 0.9rem;
    }
    .folio-badge strong {
      color: var(--token-naranja-primario);
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
    .partidas-tabla tr:last-child td {
      border-bottom: none;
    }
    .col-center {
      text-align: center;
    }
    .col-right {
      text-align: right;
    }
    .nombre-platillo-comprobante {
      font-weight: 600;
    }
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
      margin-bottom: 18px;
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

    .comprobante-acciones {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .btn-nueva-venta {
      width: 100%;
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
      .comprobante-acciones {
        flex-direction: row;
      }
      .comprobante-acciones button {
        flex: 1;
      }
    }
  `]
})
export class VentaComponent implements OnInit {
  authService = inject(AuthService);
  private inventarioService = inject(InventarioApiService);
  private promocionesService = inject(PromocionesApiService);
  private ventasService = inject(VentasApiService);
  private router = inject(Router);

  // Estados del Catálogo
  cargandoCatalogo = signal<boolean>(true);
  platillos = signal<PlatilloDTO[]>([]);
  filtroTexto = '';

  // Estados del Carrito y Cotización
  carrito = signal<ItemCarrito[]>([]);
  cotizacion = signal<ResultadoCotizacionDTO | null>(null);
  cotizando = signal<boolean>(false);
  metodoPagoSeleccionado = signal<MetodoPago>('EFECTIVO');

  // Estados de Confirmación y Comprobante (W4-03 / W4-04)
  confirmando = signal<boolean>(false);
  comprobanteVisible = signal<boolean>(false);
  ordenComprobante = signal<OrdenDTO | null>(null);

  // Mensajería y Feedback
  mensajeExito = signal<string>('');
  mensajeAlerta = signal<string>('');
  mensajeError = signal<string>('');

  // Clave de Idempotencia y Transacción en Vuelo (CW-07 / CW-19)
  claveIdempotenciaActual = this.generarUUID();
  ventaPendienteClave = signal<string | null>(null);
  recuperando = signal<boolean>(false);

  // Platillos filtrados por búsqueda
  platillosFiltrados = computed(() => {
    const query = this.filtroTexto.trim().toLowerCase();
    if (!query) return this.platillos();
    return this.platillos().filter(p => p.nombre.toLowerCase().includes(query));
  });

  ngOnInit(): void {
    this.cargarCatalogo();
    this.revisarVentaPendienteLocal();
  }

  /**
   * Carga el catálogo público de platillos activos con recetas válidas
   */
  cargarCatalogo(): void {
    this.cargandoCatalogo.set(true);
    this.inventarioService.listarPlatillosPublicos().subscribe({
      next: (platillos) => {
        this.platillos.set(platillos);
        this.cargandoCatalogo.set(false);
      },
      error: (err) => {
        this.mensajeError.set(err.error?.mensaje || 'Error al cargar los platillos del catálogo.');
        this.cargandoCatalogo.set(false);
      }
    });
  }

  // =========================================================================
  // GESTIÓN DEL CARRITO
  // =========================================================================

  agregarAlCarrito(platillo: PlatilloDTO): void {
    this.limpiarMensajes();
    const actual = this.carrito();
    const existente = actual.find(i => i.platillo.id === platillo.id);

    if (existente) {
      existente.cantidad += 1;
      this.carrito.set([...actual]);
    } else {
      this.carrito.set([...actual, { platillo, cantidad: 1 }]);
    }

    this.recalcularCotizacion();
  }

  incrementarCantidad(item: ItemCarrito): void {
    this.limpiarMensajes();
    item.cantidad += 1;
    this.carrito.set([...this.carrito()]);
    this.recalcularCotizacion();
  }

  decrementarCantidad(item: ItemCarrito): void {
    this.limpiarMensajes();
    const actual = this.carrito();
    if (item.cantidad > 1) {
      item.cantidad -= 1;
      this.carrito.set([...actual]);
    } else {
      this.carrito.set(actual.filter(i => i.platillo.id !== item.platillo.id));
    }
    this.recalcularCotizacion();
  }

  vaciarCarrito(): void {
    this.limpiarMensajes();
    this.carrito.set([]);
    this.cotizacion.set(null);
  }

  estaEnCarrito(platilloId: number): boolean {
    return this.carrito().some(i => i.platillo.id === platilloId);
  }

  obtenerCantidadEnCarrito(platilloId: number): number {
    const item = this.carrito().find(i => i.platillo.id === platilloId);
    return item ? item.cantidad : 0;
  }

  // =========================================================================
  // COTIZACIÓN Y EVALUACIÓN ECONÓMICA (W4-02 / CW-11 / CW-12 / CW-13)
  // =========================================================================

  recalcularCotizacion(): void {
    const items = this.carrito();
    if (items.length === 0) {
      this.cotizacion.set(null);
      return;
    }

    this.cotizando.set(true);
    const payload: ItemCotizacionInput[] = items.map(i => ({
      platilloId: i.platillo.id,
      cantidad: i.cantidad
    }));

    this.promocionesService.cotizarOrden(payload).subscribe({
      next: (resultado) => {
        this.cotizacion.set(resultado);
        this.cotizando.set(false);

        // Si el total es 0.00 (promoción 100%), fijar método a SIN_COBRO
        if (Number(resultado.total) === 0) {
          this.metodoPagoSeleccionado.set('SIN_COBRO');
        } else if (this.metodoPagoSeleccionado() === 'SIN_COBRO') {
          this.metodoPagoSeleccionado.set('EFECTIVO');
        }
      },
      error: (err) => {
        this.cotizando.set(false);
        this.mensajeError.set(err.error?.mensaje || 'Error al cotizar los platillos.');
      }
    });
  }

  tieneDescuento(): boolean {
    const cot = this.cotizacion();
    if (!cot) return false;
    return Number(cot.descuentoTotal) > 0;
  }

  hayUnidadesBonificadas(): boolean {
    const cot = this.cotizacion();
    if (!cot) return false;
    return cot.partidas.some(p => p.unidadesBonificadas > 0);
  }

  esTotalCero(): boolean {
    const cot = this.cotizacion();
    if (!cot) return false;
    return Number(cot.total) === 0;
  }

  // =========================================================================
  // CONFIRMACIÓN TRANSACCIONAL DE LA VENTA (W4-03 / CW-05, CW-06, CW-07, CW-14)
  // =========================================================================

  confirmarVenta(): void {
    this.limpiarMensajes();
    const cot = this.cotizacion();
    const items = this.carrito();

    if (!cot || items.length === 0) {
      this.mensajeError.set('El carrito está vacío. Agrega platillos antes de confirmar.');
      return;
    }

    if (this.confirmando()) return;

    this.confirmando.set(true);

    // Guardar clave pendiente en sessionStorage para recuperación ante corte de red (CW-19)
    this.guardarVentaPendienteLocal(this.claveIdempotenciaActual);

    const input: ConfirmarVentaInput = {
      claveIdempotencia: this.claveIdempotenciaActual,
      metodoPago: this.esTotalCero() ? 'SIN_COBRO' : this.metodoPagoSeleccionado(),
      items: items.map(i => ({ platilloId: i.platillo.id, cantidad: i.cantidad })),
      cotizacionAceptada: cot
    };

    this.ventasService.confirmarVenta(input).subscribe({
      next: (orden) => {
        this.confirmando.set(false);
        this.borrarVentaPendienteLocal();

        // Limpiar carrito y generar nueva clave idempotente para la siguiente orden
        this.carrito.set([]);
        this.cotizacion.set(null);
        this.claveIdempotenciaActual = this.generarUUID();

        // Mostrar comprobante
        this.ordenComprobante.set(orden);
        this.comprobanteVisible.set(true);
        this.mensajeExito.set(`Venta ${orden.folio} confirmada con éxito.`);
      },
      error: (err) => {
        this.confirmando.set(false);
        this.borrarVentaPendienteLocal();

        const codigo = err.error?.codigo;
        if (codigo === 'STOCK_INSUFICIENTE') {
          // CW-06: Rollback atómico verificado
          this.mensajeError.set(
            'Stock insuficiente en inventario: uno o más insumos de la receta no alcanzan para cubrir la orden. La venta fue cancelada sin cargos ni registros.'
          );
        } else if (codigo === 'COTIZACION_DESACTUALIZADA') {
          // CW-14: Revalidación económica obligatoria
          this.mensajeAlerta.set(
            'Atención: Los precios o promociones cambiaron en el sistema. Se calculó una nueva cotización. Por favor verifica el nuevo total y presiona "Confirmar Venta" para aceptar.'
          );
          if (err.error?.detalles?.cotizacionActualizada) {
            this.cotizacion.set(err.error.detalles.cotizacionActualizada);
          } else {
            this.recalcularCotizacion();
          }
        } else if (codigo === 'IDEMPOTENCIA_CONFLICTO') {
          this.mensajeError.set('Conflicto de idempotencia: Se intentó usar una clave existente con datos diferentes.');
          this.claveIdempotenciaActual = this.generarUUID();
        } else {
          this.mensajeError.set(err.error?.mensaje || 'Error al procesar la confirmación de la venta.');
        }
      }
    });
  }

  // =========================================================================
  // GESTIÓN DE COMPROBANTE Y SIGUIENTE VENTA (W4-04)
  // =========================================================================

  iniciarNuevaVenta(): void {
    this.comprobanteVisible.set(false);
    this.ordenComprobante.set(null);
    this.limpiarMensajes();
    this.vaciarCarrito();
    this.claveIdempotenciaActual = this.generarUUID();
  }

  cerrarComprobante(): void {
    this.comprobanteVisible.set(false);
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

  // =========================================================================
  // RECUPERACIÓN ANTE RESPUESTA PERDIDA / CORTE DE RED (CW-07 / CW-19)
  // =========================================================================

  private guardarVentaPendienteLocal(clave: string): void {
    try {
      sessionStorage.setItem('asmibuy_transaccion_vuelo', clave);
    } catch {
      // Ignorar restricciones en entornos aislados
    }
  }

  private borrarVentaPendienteLocal(): void {
    try {
      sessionStorage.removeItem('asmibuy_transaccion_vuelo');
      this.ventaPendienteClave.set(null);
    } catch {}
  }

  private revisarVentaPendienteLocal(): void {
    try {
      const clave = sessionStorage.getItem('asmibuy_transaccion_vuelo');
      if (clave) {
        this.ventaPendienteClave.set(clave);
      }
    } catch {}
  }

  verificarVentaPendiente(): void {
    const clave = this.ventaPendienteClave();
    if (!clave) return;

    this.recuperando.set(true);
    this.ventasService.recuperarVenta(clave).subscribe({
      next: (res) => {
        this.recuperando.set(false);
        this.borrarVentaPendienteLocal();

        if (res.encontrada && res.orden) {
          this.ordenComprobante.set(res.orden);
          this.comprobanteVisible.set(true);
          this.mensajeExito.set(`Venta previa ${res.orden.folio} recuperada con éxito.`);
          this.vaciarCarrito();
        } else {
          this.mensajeAlerta.set('La venta pendiente no fue registrada en el servidor. Puedes intentar confirmarla de nuevo.');
        }
      },
      error: (err) => {
        this.recuperando.set(false);
        this.mensajeError.set(err.error?.mensaje || 'No se pudo verificar el estado de la venta pendiente.');
      }
    });
  }

  descartarVentaPendiente(): void {
    this.borrarVentaPendienteLocal();
    this.claveIdempotenciaActual = this.generarUUID();
  }

  // =========================================================================
  // UTILIDADES
  // =========================================================================

  private generarUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private limpiarMensajes(): void {
    this.mensajeExito.set('');
    this.mensajeAlerta.set('');
    this.mensajeError.set('');
  }

  trackPorPlatilloId(_index: number, platillo: PlatilloDTO): number {
    return platillo.id;
  }

  trackPorItemPlatilloId(_index: number, item: ItemCarrito): number {
    return item.platillo.id;
  }
}
