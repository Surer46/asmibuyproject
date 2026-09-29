import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  InventarioApiService,
  IngredienteDTO,
  PlatilloDTO,
  MovimientoInventarioDTO,
  UnidadIngrediente
} from '../../services/inventario.service';
import {
  PromocionesApiService,
  PromocionDTO,
  TipoPromocion,
  DuracionPromocion,
  EstadoPromocion
} from '../../services/promociones.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-gestion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="app-container">
      <!-- Encabezado Cupertino -->
      <div class="view-header">
        <div>
          <h2>Gestión de Catálogo e Inventario</h2>
          <p class="subtitle">Administración de insumos, recetas y kárdex de almacén</p>
        </div>
      </div>

      <!-- Notificaciones de éxito y error -->
      <div *ngIf="mensajeExito()" class="notificacion notif-exito">
        <span class="material-symbols-rounded">check_circle</span>
        <span>{{ mensajeExito() }}</span>
      </div>

      <div *ngIf="mensajeError()" class="notificacion notif-error">
        <span class="material-symbols-rounded">error</span>
        <span>{{ mensajeError() }}</span>
      </div>

      <!-- Segmented Control Cupertino -->
      <div class="segmented-control" role="tablist">
        <button
          role="tab"
          [attr.aria-selected]="tabActiva() === 'ingredientes'"
          [class.activo]="tabActiva() === 'ingredientes'"
          (click)="tabActiva.set('ingredientes')">
          <span class="material-symbols-rounded">egg</span>
          Insumos ({{ ingredientes().length }})
        </button>
        <button
          role="tab"
          [attr.aria-selected]="tabActiva() === 'platillos'"
          [class.activo]="tabActiva() === 'platillos'"
          (click)="tabActiva.set('platillos')">
          <span class="material-symbols-rounded">lunch_dining</span>
          Platillos ({{ platillos().length }})
        </button>
        <button
          role="tab"
          [attr.aria-selected]="tabActiva() === 'movimientos'"
          [class.activo]="tabActiva() === 'movimientos'"
          (click)="tabActiva.set('movimientos')">
          <span class="material-symbols-rounded">history</span>
          Movimientos
        </button>
        <button
          role="tab"
          [attr.aria-selected]="tabActiva() === 'promociones'"
          [class.activo]="tabActiva() === 'promociones'"
          (click)="tabActiva.set('promociones')">
          <span class="material-symbols-rounded">loyalty</span>
          Promociones ({{ promociones().length }})
        </button>
      </div>

      <!-- ============================================================= -->
      <!-- PESTAÑA 1: INSUMOS E INGREDIENTES                             -->
      <!-- ============================================================= -->
      <div *ngIf="tabActiva() === 'ingredientes'" class="tab-content">
        <div class="toolbar">
          <span class="seccion-titulo">Insumos y Mínimos de Stock</span>
          <button class="btn-cupertino btn-naranja" (click)="abrirModalIngrediente()">
            <span class="material-symbols-rounded">add</span>
            Nuevo Insumo
          </button>
        </div>

        <div *ngIf="cargando()" class="loading-state">
          <p>Cargando insumos del almacén...</p>
        </div>

        <div *ngIf="!cargando() && ingredientes().length === 0" class="empty-state card-cupertino">
          <span class="material-symbols-rounded icon-grande">inventory_2</span>
          <p>No hay insumos registrados en el catálogo.</p>
        </div>

        <div class="lista-agrupada" *ngIf="!cargando()">
          <div *ngFor="let ing of ingredientes()" class="item-fila card-cupertino">
            <div class="fila-info">
              <div class="fila-titulo-row">
                <span class="item-nombre">{{ ing.nombre }}</span>
                <span
                  class="badge"
                  [ngClass]="{
                    'badge-rojo': ing.estadoStock === 'AGOTADO',
                    'badge-amarillo': ing.estadoStock === 'BAJO_STOCK',
                    'badge-verde': ing.estadoStock === 'NORMAL'
                  }">
                  {{ ing.estadoStock }}
                </span>
                <span *ngIf="!ing.activo" class="badge badge-inactivo">INACTIVO</span>
              </div>
              <div class="fila-detalles">
                <span>Unidad: <strong>{{ ing.unidad }}</strong></span>
                <span>Existencia: <strong>{{ ing.existencia }} {{ ing.unidad }}</strong></span>
                <span>Mínimo: <strong>{{ ing.minimo }} {{ ing.unidad }}</strong></span>
              </div>
            </div>
            <div class="fila-acciones">
              <button class="btn-icon" (click)="editarIngrediente(ing)" title="Editar insumo">
                <span class="material-symbols-rounded">edit</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================= -->
      <!-- PESTAÑA 2: PLATILLOS Y RECETAS                                -->
      <!-- ============================================================= -->
      <div *ngIf="tabActiva() === 'platillos'" class="tab-content">
        <div class="toolbar">
          <span class="seccion-titulo">Catálogo de Platillos y Recetas</span>
          <button class="btn-cupertino btn-naranja" (click)="abrirModalPlatillo()">
            <span class="material-symbols-rounded">add</span>
            Nuevo Platillo
          </button>
        </div>

        <div *ngIf="cargando()" class="loading-state">
          <p>Cargando platillos y recetas...</p>
        </div>

        <div *ngIf="!cargando() && platillos().length === 0" class="empty-state card-cupertino">
          <span class="material-symbols-rounded icon-grande">restaurant_menu</span>
          <p>No hay platillos dados de alta.</p>
        </div>

        <div class="lista-agrupada" *ngIf="!cargando()">
          <div *ngFor="let plat of platillos()" class="item-fila card-cupertino">
            <div class="fila-info">
              <div class="fila-titulo-row">
                <span class="item-nombre">{{ plat.nombre }}</span>
                <span class="precio-tag">\${{ plat.precio }}</span>
                <span *ngIf="!plat.activo" class="badge badge-inactivo">INACTIVO</span>
                <span *ngIf="!plat.recetaValida" class="badge badge-rojo">RECETA INVÁLIDA</span>
              </div>
              <!-- Desglose de Receta -->
              <div class="receta-resumen">
                <span class="receta-lbl">Receta:</span>
                <span *ngIf="!plat.ingredientes || plat.ingredientes.length === 0" class="receta-vacia">Sin ingredientes configurados</span>
                <div class="receta-tags" *ngIf="plat.ingredientes && plat.ingredientes.length > 0">
                  <span *ngFor="let item of plat.ingredientes" class="receta-item-chip">
                    {{ item.nombreIngrediente }}: {{ item.cantidad }} {{ item.unidad }}
                  </span>
                </div>
              </div>
            </div>
            <div class="fila-acciones">
              <button class="btn-icon" (click)="editarPlatillo(plat)" title="Editar receta">
                <span class="material-symbols-rounded">edit</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================= -->
      <!-- PESTAÑA 3: MOVIMIENTOS Y KÁRDEX                               -->
      <!-- ============================================================= -->
      <div *ngIf="tabActiva() === 'movimientos'" class="tab-content">
        <div class="toolbar toolbar-wrap">
          <span class="seccion-titulo">Kárdex de Movimientos de Inventario</span>
          <div class="btn-group-acciones">
            <button class="btn-cupertino btn-verde" (click)="abrirModalEntrada()">
              <span class="material-symbols-rounded">add_circle</span>
              Entrada
            </button>
            <button class="btn-cupertino btn-amarillo" (click)="abrirModalAjuste()">
              <span class="material-symbols-rounded">tune</span>
              Ajuste / Merma
            </button>
          </div>
        </div>

        <div *ngIf="cargando()" class="loading-state">
          <p>Cargando historial de movimientos...</p>
        </div>

        <div class="lista-agrupada" *ngIf="!cargando()">
          <div *ngFor="let mov of movimientos()" class="item-fila card-cupertino">
            <div class="fila-info">
              <div class="fila-titulo-row">
                <span
                  class="badge"
                  [ngClass]="{
                    'badge-verde': mov.tipo === 'ENTRADA',
                    'badge-amarillo': mov.tipo === 'AJUSTE',
                    'badge-rojo': mov.tipo === 'CONSUMO_VENTA'
                  }">
                  {{ mov.tipo }}
                </span>
                <span class="item-nombre">{{ mov.nombreIngrediente }}</span>
                <span class="mov-cantidad" [ngClass]="{ 'cant-positiva': mov.cantidad.startsWith('+'), 'cant-negativa': mov.cantidad.startsWith('-') }">
                  {{ mov.cantidad }} {{ mov.unidad }}
                </span>
              </div>
              <div class="fila-detalles">
                <span>Motivo: <em>{{ mov.motivo }}</em></span>
                <span *ngIf="mov.ordenId">Folio: <strong>#{{ mov.ordenId }}</strong></span>
                <span>Por: <strong>{{ mov.nombreUsuario }}</strong></span>
                <span>Fecha: {{ formatearFecha(mov.creadoEn) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================= -->
      <!-- PESTAÑA 4: PROMOCIONES Y DESCUENTOS                           -->
      <!-- ============================================================= -->
      <div *ngIf="tabActiva() === 'promociones'" class="tab-content">
        <div class="toolbar">
          <span class="seccion-titulo">Reglas de Promociones y Descuentos</span>
          <button class="btn-cupertino btn-morado" (click)="abrirModalPromocion()">
            <span class="material-symbols-rounded">add</span>
            Nueva Promoción
          </button>
        </div>

        <div *ngIf="cargando()" class="loading-state">
          <span class="material-symbols-rounded icon-grande spin">progress_activity</span>
          <p>Cargando promociones...</p>
        </div>

        <div *ngIf="!cargando() && promociones().length === 0" class="empty-state card-cupertino">
          <span class="material-symbols-rounded icon-grande">loyalty</span>
          <p>No hay promociones registradas aún.</p>
          <button class="btn-cupertino btn-morado btn-sm" (click)="abrirModalPromocion()">
            Crear Primera Promoción
          </button>
        </div>

        <div class="lista-agrupada" *ngIf="!cargando()">
          <div *ngFor="let promo of promociones()" class="item-fila card-cupertino">
            <div class="fila-info">
              <div class="fila-titulo-row">
                <span
                  class="badge"
                  [ngClass]="{
                    'badge-morado': promo.tipo === 'PORCENTAJE',
                    'badge-verde': promo.tipo === 'NXM'
                  }">
                  {{ promo.tipo }}
                </span>
                <span
                  class="badge"
                  [ngClass]="{
                    'badge-verde': promo.vigente,
                    'badge-inactivo': !promo.vigente
                  }">
                  {{ promo.vigente ? 'VIGENTE' : (promo.estado === 'RETIRADA' ? 'RETIRADA' : (promo.estado === 'INACTIVA' ? 'PAUSADA' : 'NO VIGENTE')) }}
                </span>
                <span class="badge badge-inactivo">{{ promo.duracion }}</span>
                <span class="item-nombre">{{ promo.nombre }}</span>
              </div>
              <div class="fila-detalles">
                <span>Platillo: <strong>{{ promo.nombrePlatillo }}</strong> ($ {{ promo.precioPlatillo }})</span>
                <span *ngIf="promo.tipo === 'PORCENTAJE'">Descuento: <strong>{{ promo.porcentaje }}%</strong></span>
                <span *ngIf="promo.tipo === 'NXM'">Paquete: <strong>{{ promo.n }}x{{ promo.m }}</strong> (Paga {{ promo.m }}, lleva {{ promo.n }})</span>
                <span *ngIf="promo.duracion === 'TEMPORAL'">
                  Vigencia: {{ formatearFecha(promo.fechaInicio || '') }} a {{ formatearFecha(promo.fechaFin || '') }} (Hora local)
                </span>
                <span *ngIf="promo.duracion === 'PERMANENTE'">
                  <em>Sin vencimiento</em>
                </span>
              </div>
            </div>

            <div class="fila-acciones" *ngIf="promo.estado !== 'RETIRADA'">
              <button
                class="btn-icon"
                (click)="abrirModalEditarPromocion(promo)"
                title="Editar Promoción"
                aria-label="Editar">
                <span class="material-symbols-rounded">edit</span>
              </button>

              <button
                class="btn-icon"
                [ngClass]="{ 'btn-peligro': promo.estado === 'ACTIVA' }"
                (click)="conmutarEstadoPromocion(promo)"
                [title]="promo.estado === 'ACTIVA' ? 'Pausar Promoción' : 'Activar Promoción'"
                [attr.aria-label]="promo.estado === 'ACTIVA' ? 'Pausar' : 'Activar'">
                <span class="material-symbols-rounded">{{ promo.estado === 'ACTIVA' ? 'pause_circle' : 'play_circle' }}</span>
              </button>

              <button
                class="btn-icon btn-peligro"
                (click)="confirmarRetiroPromocion(promo)"
                title="Retirar definitivamente"
                aria-label="Retirar">
                <span class="material-symbols-rounded">archive</span>
              </button>
            </div>

            <div class="fila-acciones" *ngIf="promo.estado === 'RETIRADA'">
              <span class="badge badge-rojo">HISTÓRICO</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================= -->
      <!-- MODAL: FORMULARIO DE INGREDIENTE                              -->
      <!-- ============================================================= -->
      <div *ngIf="mostrarModalIngrediente()" class="modal-overlay">
        <div class="modal-card card-cupertino">
          <div class="modal-header">
            <h3>{{ modoEdicionIngrediente() ? 'Editar Insumo' : 'Nuevo Insumo' }}</h3>
            <button class="btn-cerrar" (click)="cerrarModales()">✕</button>
          </div>
          <form (ngSubmit)="guardarIngrediente()">
            <div class="form-group">
              <label for="ing-nombre">Nombre del Insumo *</label>
              <input
                id="ing-nombre"
                type="text"
                [(ngModel)]="formIngrediente.nombre"
                name="nombre"
                required
                placeholder="Ej. Pan de Hamburguesa"
                class="input-cupertino" />
            </div>

            <div class="form-group">
              <label for="ing-unidad">Unidad Base *</label>
              <select
                id="ing-unidad"
                [(ngModel)]="formIngrediente.unidad"
                name="unidad"
                required
                class="input-cupertino">
                <option value="g">Gramos (g)</option>
                <option value="ml">Mililitros (ml)</option>
                <option value="pieza">Pieza (entero)</option>
              </select>
              <small *ngIf="modoEdicionIngrediente()" class="input-hint">
                Nota: La unidad es inmutable si el insumo ya tiene recetas o movimientos registrados.
              </small>
            </div>

            <div class="form-group">
              <label for="ing-minimo">Stock Mínimo Obligatorio *</label>
              <input
                id="ing-minimo"
                type="number"
                step="any"
                min="0"
                [(ngModel)]="formIngrediente.minimo"
                name="minimo"
                required
                class="input-cupertino" />
              <small class="input-hint">Activa la condición de Bajo Stock si la existencia es menor o igual a este valor.</small>
            </div>

            <div *ngIf="modoEdicionIngrediente()" class="form-group form-check">
              <label>
                <input type="checkbox" [(ngModel)]="formIngrediente.activo" name="activo" />
                Insumo Activo para recetas y operaciones
              </label>
            </div>

            <div class="modal-acciones">
              <button type="button" class="btn-cupertino btn-secundario" (click)="cerrarModales()">Cancelar</button>
              <button type="submit" class="btn-cupertino btn-verde" [disabled]="guardando()">
                {{ guardando() ? 'Guardando...' : 'Guardar Insumo' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- ============================================================= -->
      <!-- MODAL: FORMULARIO DE PLATILLO Y RECETA                        -->
      <!-- ============================================================= -->
      <div *ngIf="mostrarModalPlatillo()" class="modal-overlay">
        <div class="modal-card card-cupertino modal-ancho">
          <div class="modal-header">
            <h3>{{ modoEdicionPlatillo() ? 'Editar Platillo y Receta' : 'Nuevo Platillo' }}</h3>
            <button class="btn-cerrar" (click)="cerrarModales()">✕</button>
          </div>
          <form (ngSubmit)="guardarPlatillo()">
            <div class="grid-dos-cols">
              <div class="form-group">
                <label for="plat-nombre">Nombre del Platillo *</label>
                <input
                  id="plat-nombre"
                  type="text"
                  [(ngModel)]="formPlatillo.nombre"
                  name="platNombre"
                  required
                  placeholder="Ej. Hamburguesa Clásica"
                  class="input-cupertino" />
              </div>
              <div class="form-group">
                <label for="plat-precio">Precio de Venta (\$) *</label>
                <input
                  id="plat-precio"
                  type="number"
                  step="0.01"
                  min="0.01"
                  [(ngModel)]="formPlatillo.precio"
                  name="platPrecio"
                  required
                  placeholder="120.00"
                  class="input-cupertino" />
              </div>
            </div>

            <div *ngIf="modoEdicionPlatillo()" class="form-group form-check">
              <label>
                <input type="checkbox" [(ngModel)]="formPlatillo.activo" name="platActivo" />
                Platillo Activo para Venta
              </label>
            </div>

            <!-- Constructor de Receta -->
            <div class="receta-builder">
              <div class="receta-header-row">
                <h4>Ingredientes de la Receta (Al menos uno obligatorio)</h4>
                <button type="button" class="btn-cupertino btn-secundario btn-sm" (click)="agregarFilaReceta()">
                  <span class="material-symbols-rounded">add</span>
                  Agregar Insumo
                </button>
              </div>

              <div *ngFor="let item of formPlatillo.receta; let i = index" class="receta-fila">
                <div class="col-ing">
                  <select [(ngModel)]="item.ingredienteId" name="recetaIng_{{i}}" required class="input-cupertino">
                    <option [ngValue]="0" disabled>Selecciona insumo...</option>
                    <option *ngFor="let ing of ingredientesActivos()" [ngValue]="ing.id">
                      {{ ing.nombre }} ({{ ing.unidad }})
                    </option>
                  </select>
                </div>
                <div class="col-cant">
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    [(ngModel)]="item.cantidad"
                    name="recetaCant_{{i}}"
                    required
                    placeholder="Cantidad"
                    class="input-cupertino" />
                </div>
                <div class="col-btn">
                  <button type="button" class="btn-icon btn-peligro" (click)="removerFilaReceta(i)" title="Quitar">
                    <span class="material-symbols-rounded">delete</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="modal-acciones">
              <button type="button" class="btn-cupertino btn-secundario" (click)="cerrarModales()">Cancelar</button>
              <button type="submit" class="btn-cupertino btn-verde" [disabled]="guardando()">
                {{ guardando() ? 'Guardando...' : 'Guardar Platillo' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- ============================================================= -->
      <!-- MODAL: REGISTRAR ENTRADA                                      -->
      <!-- ============================================================= -->
      <div *ngIf="mostrarModalEntrada()" class="modal-overlay">
        <div class="modal-card card-cupertino">
          <div class="modal-header">
            <h3>Registrar Entrada de Almacén</h3>
            <button class="btn-cerrar" (click)="cerrarModales()">✕</button>
          </div>
          <form (ngSubmit)="guardarEntrada()">
            <div class="form-group">
              <label for="ent-ing">Insumo Recibido *</label>
              <select id="ent-ing" [(ngModel)]="formEntrada.ingredienteId" name="entIng" required class="input-cupertino">
                <option [ngValue]="0" disabled>Selecciona insumo...</option>
                <option *ngFor="let ing of ingredientesActivos()" [ngValue]="ing.id">
                  {{ ing.nombre }} (Existencia actual: {{ ing.existencia }} {{ ing.unidad }})
                </option>
              </select>
            </div>
            <div class="form-group">
              <label for="ent-cant">Cantidad a Ingresar *</label>
              <input
                id="ent-cant"
                type="number"
                step="any"
                min="0.001"
                [(ngModel)]="formEntrada.cantidad"
                name="entCant"
                required
                class="input-cupertino" />
            </div>
            <div class="form-group">
              <label for="ent-mot">Motivo o Referencia (Opcional)</label>
              <input
                id="ent-mot"
                type="text"
                [(ngModel)]="formEntrada.motivo"
                name="entMot"
                placeholder="Ej. Factura F-4892 / Compra proveedor"
                class="input-cupertino" />
            </div>
            <div class="modal-acciones">
              <button type="button" class="btn-cupertino btn-secundario" (click)="cerrarModales()">Cancelar</button>
              <button type="submit" class="btn-cupertino btn-verde" [disabled]="guardando()">
                {{ guardando() ? 'Registrando...' : 'Registrar Entrada' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- ============================================================= -->
      <!-- MODAL: REGISTRAR AJUSTE / MERMA                               -->
      <!-- ============================================================= -->
      <div *ngIf="mostrarModalAjuste()" class="modal-overlay">
        <div class="modal-card card-cupertino">
          <div class="modal-header">
            <h3>Registrar Ajuste / Merma de Inventario</h3>
            <button class="btn-cerrar" (click)="cerrarModales()">✕</button>
          </div>
          <form (ngSubmit)="guardarAjuste()">
            <div class="form-group">
              <label for="aj-ing">Insumo a Ajustar *</label>
              <select id="aj-ing" [(ngModel)]="formAjuste.ingredienteId" name="ajIng" required class="input-cupertino">
                <option [ngValue]="0" disabled>Selecciona insumo...</option>
                <option *ngFor="let ing of ingredientesActivos()" [ngValue]="ing.id">
                  {{ ing.nombre }} (Existencia actual: {{ ing.existencia }} {{ ing.unidad }})
                </option>
              </select>
            </div>
            <div class="form-group">
              <label for="aj-cant">Cantidad (+ para sobrante, - para merma/desperdicio) *</label>
              <input
                id="aj-cant"
                type="number"
                step="any"
                [(ngModel)]="formAjuste.cantidad"
                name="ajCant"
                required
                placeholder="-5.000 o 2"
                class="input-cupertino" />
              <small class="input-hint">El stock nunca puede resultar negativo (Criterio CW-04).</small>
            </div>
            <div class="form-group">
              <label for="aj-mot">Motivo Justificado (Obligatorio) *</label>
              <input
                id="aj-mot"
                type="text"
                [(ngModel)]="formAjuste.motivo"
                name="ajMot"
                required
                placeholder="Ej. Merma por cocción / Caducidad / Conteo físico"
                class="input-cupertino" />
            </div>
            <div class="modal-acciones">
              <button type="button" class="btn-cupertino btn-secundario" (click)="cerrarModales()">Cancelar</button>
              <button type="submit" class="btn-cupertino btn-amarillo" [disabled]="guardando()">
                {{ guardando() ? 'Registrando...' : 'Aplicar Ajuste' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- ============================================================= -->
      <!-- MODAL: FORMULARIO DE PROMOCIÓN                                -->
      <!-- ============================================================= -->
      <div *ngIf="mostrarModalPromocion()" class="modal-overlay">
        <div class="modal-card card-cupertino modal-ancho">
          <div class="modal-header">
            <h3>{{ modoEdicionPromocion() ? 'Editar Promoción' : 'Nueva Promoción' }}</h3>
            <button class="btn-cerrar" (click)="cerrarModales()">✕</button>
          </div>

          <form (ngSubmit)="guardarPromocion()">
            <div class="form-group">
              <label for="promo-nombre">Nombre de la Promoción *</label>
              <input
                id="promo-nombre"
                type="text"
                [(ngModel)]="formPromocion.nombre"
                name="promoNombre"
                required
                placeholder="Ej. Martes 2x1 Clásica"
                class="input-cupertino" />
            </div>

            <div class="form-group">
              <label for="promo-platillo">Platillo Participante (Único) *</label>
              <select
                id="promo-platillo"
                [(ngModel)]="formPromocion.platilloId"
                name="promoPlatillo"
                required
                class="input-cupertino">
                <option [ngValue]="0" disabled>Selecciona un platillo...</option>
                <option *ngFor="let p of platillosActivos()" [ngValue]="p.id">
                  {{ p.nombre }} ($ {{ p.precio }})
                </option>
              </select>
              <small class="campo-ayuda">Por regla del contrato W3-01, una promoción aplica únicamente a un platillo.</small>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label for="promo-tipo">Tipo de Descuento *</label>
                <select
                  id="promo-tipo"
                  [(ngModel)]="formPromocion.tipo"
                  name="promoTipo"
                  required
                  class="input-cupertino">
                  <option value="PORCENTAJE">Porcentaje (%)</option>
                  <option value="NXM">NxM (Mismo Platillo)</option>
                </select>
              </div>

              <div class="form-group">
                <label for="promo-duracion">Duración *</label>
                <select
                  id="promo-duracion"
                  [(ngModel)]="formPromocion.duracion"
                  name="promoDuracion"
                  required
                  class="input-cupertino">
                  <option value="PERMANENTE">Permanente (Sin vencimiento)</option>
                  <option value="TEMPORAL">Temporal (Con fecha y hora)</option>
                </select>
              </div>
            </div>

            <!-- Campos condicionales para PORCENTAJE -->
            <div *ngIf="formPromocion.tipo === 'PORCENTAJE'" class="form-group">
              <label for="promo-porcentaje">Porcentaje de Descuento (1 - 100 %) *</label>
              <input
                id="promo-porcentaje"
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                [(ngModel)]="formPromocion.porcentaje"
                name="promoPorcentaje"
                placeholder="Ej. 15"
                class="input-cupertino" />
              <small class="campo-ayuda">Calculado sobre la línea del platillo. 100% permite total cero.</small>
            </div>

            <!-- Campos condicionales para NXM -->
            <div *ngIf="formPromocion.tipo === 'NXM'" class="form-row-2">
              <div class="form-group">
                <label for="promo-n">Lleva N unidades *</label>
                <input
                  id="promo-n"
                  type="number"
                  min="2"
                  step="1"
                  [(ngModel)]="formPromocion.n"
                  name="promoN"
                  placeholder="Ej. 2 (en 2x1)"
                  class="input-cupertino" />
              </div>

              <div class="form-group">
                <label for="promo-m">Paga M unidades *</label>
                <input
                  id="promo-m"
                  type="number"
                  min="1"
                  step="1"
                  [(ngModel)]="formPromocion.m"
                  name="promoM"
                  placeholder="Ej. 1 (en 2x1)"
                  class="input-cupertino" />
              </div>
            </div>
            <small *ngIf="formPromocion.tipo === 'NXM'" class="campo-ayuda">
              Debe cumplirse N > M >= 1. Las unidades entregadas consumen receta completa.
            </small>

            <!-- Campos condicionales para TEMPORAL -->
            <div *ngIf="formPromocion.duracion === 'TEMPORAL'" class="form-row-2">
              <div class="form-group">
                <label for="promo-inicio">Fecha y Hora de Inicio * (Hora local)</label>
                <input
                  id="promo-inicio"
                  type="datetime-local"
                  [(ngModel)]="formPromocion.fechaInicioLocal"
                  name="promoInicio"
                  class="input-cupertino" />
                <small class="campo-ayuda">Inicio inclusivo</small>
              </div>

              <div class="form-group">
                <label for="promo-fin">Fecha y Hora de Fin * (Hora local)</label>
                <input
                  id="promo-fin"
                  type="datetime-local"
                  [(ngModel)]="formPromocion.fechaFinLocal"
                  name="promoFin"
                  class="input-cupertino" />
                <small class="campo-ayuda">Fin exclusivo</small>
              </div>
            </div>

            <div class="modal-acciones">
              <button type="button" class="btn-cupertino btn-secundario" (click)="cerrarModales()">Cancelar</button>
              <button type="submit" class="btn-cupertino btn-morado" [disabled]="guardando()">
                {{ guardando() ? 'Guardando...' : (modoEdicionPromocion() ? 'Actualizar' : 'Crear Promoción') }}
              </button>
            </div>
          </form>
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

    /* Notificaciones */
    .notificacion {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-radius: 12px;
      margin-bottom: 14px;
      font-size: 0.9rem;
      font-weight: 500;
    }
    .notif-exito {
      background-color: var(--token-verde-fondo);
      color: var(--token-verde-oscuro);
      border: 1px solid var(--token-verde-borde);
    }
    .notif-error {
      background-color: var(--token-rojo-fondo);
      color: var(--token-rojo-alerta);
      border: 1px solid var(--token-rojo-borde);
    }

    /* Segmented Control Cupertino */
    .segmented-control {
      display: flex;
      background: #e5e5ea;
      padding: 3px;
      border-radius: 12px;
      margin-bottom: 16px;
      gap: 2px;
      overflow-x: auto;
    }
    .segmented-control button {
      flex: 1;
      min-width: 110px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 9px;
      border: none;
      background: transparent;
      font-size: 0.85rem;
      font-weight: 600;
      color: #636366;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
      font-family: inherit;
    }
    .segmented-control button.activo {
      background: #ffffff;
      color: var(--color-texto);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
    }

    /* Barra de herramientas */
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
      gap: 8px;
    }
    .toolbar-wrap {
      flex-wrap: wrap;
    }
    .seccion-titulo {
      font-weight: 700;
      font-size: 1.05rem;
      color: var(--color-texto);
    }
    .btn-group-acciones {
      display: flex;
      gap: 8px;
    }

    /* Lista agrupada */
    .lista-agrupada {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .item-fila {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      margin-bottom: 0;
    }
    .fila-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .fila-titulo-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .item-nombre {
      font-size: 1rem;
      font-weight: 600;
      color: var(--color-texto);
    }
    .precio-tag {
      font-size: 1rem;
      font-weight: 700;
      color: var(--token-verde-oscuro);
    }
    .fila-detalles {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      font-size: 0.82rem;
      color: var(--color-texto-secundario);
    }
    .fila-detalles strong {
      color: var(--color-texto);
    }

    /* Receta en platillos */
    .receta-resumen {
      margin-top: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 0.8rem;
    }
    .receta-lbl {
      color: var(--color-texto-secundario);
      font-weight: 600;
    }
    .receta-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .receta-item-chip {
      background: #f4f4f5;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 0.78rem;
      color: var(--color-texto);
      border: 1px solid var(--color-borde);
    }
    .receta-vacia {
      color: var(--token-rojo-alerta);
      font-style: italic;
    }

    /* Movimientos */
    .mov-cantidad {
      font-weight: 700;
      font-size: 0.95rem;
    }
    .cant-positiva {
      color: var(--token-verde-oscuro);
    }
    .cant-negativa {
      color: var(--token-rojo-alerta);
    }

    /* Badges */
    .badge-inactivo {
      background: #f4f4f5;
      color: #71717a;
      border: 1px solid #e4e4e7;
    }

    /* Botones de acción */
    .fila-acciones {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: 10px;
    }
    .btn-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      border: 1px solid var(--color-borde);
      background: #ffffff;
      color: var(--color-texto);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.12s;
    }
    .btn-icon:hover {
      background: #f5f5f4;
    }
    .btn-peligro {
      color: var(--token-rojo-alerta);
    }
    .btn-sm {
      min-height: 36px;
      padding: 6px 14px;
      font-size: 0.85rem;
    }

    /* Modales */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
      backdrop-filter: blur(2px);
    }
    .modal-card {
      background: #ffffff;
      width: 100%;
      max-width: 500px;
      max-height: 90vh;
      overflow-y: auto;
      margin-bottom: 0;
    }
    .modal-ancho {
      max-width: 620px;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--color-borde);
      padding-bottom: 8px;
    }
    .modal-header h3 {
      font-size: 1.15rem;
      font-weight: 700;
    }
    .btn-cerrar {
      background: transparent;
      border: none;
      font-size: 1.3rem;
      cursor: pointer;
      color: var(--color-texto-secundario);
      padding: 4px;
    }

    /* Formularios */
    .form-group {
      margin-bottom: 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .form-group label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--color-texto);
    }
    .input-cupertino {
      min-height: 44px;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid var(--color-borde);
      font-size: 0.95rem;
      font-family: inherit;
      background: #ffffff;
      color: var(--color-texto);
      width: 100%;
    }
    .input-cupertino:focus {
      border-color: var(--token-naranja-primario);
      outline: 2px solid rgba(249, 115, 22, 0.2);
    }
    .input-hint {
      font-size: 0.75rem;
      color: var(--color-texto-secundario);
    }
    .form-check {
      flex-direction: row;
      align-items: center;
      gap: 8px;
    }
    .grid-dos-cols, .form-row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .campo-ayuda {
      font-size: 0.78rem;
      color: var(--color-texto-secundario);
      margin-top: 4px;
    }

    /* Receta Builder */
    .receta-builder {
      border: 1px solid var(--color-borde);
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 16px;
      background: #fafafa;
    }
    .receta-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .receta-header-row h4 {
      font-size: 0.9rem;
      font-weight: 600;
    }
    .receta-fila {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 8px;
    }
    .col-ing {
      flex: 2;
    }
    .col-cant {
      flex: 1;
    }
    .col-btn {
      width: 40px;
    }

    .modal-acciones {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 18px;
      border-top: 1px solid var(--color-borde);
      padding-top: 14px;
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
  `]
})
export class GestionComponent implements OnInit {
  private api = inject(InventarioApiService);
  private promocionesApi = inject(PromocionesApiService);
  authService = inject(AuthService);

  // Estados y Signals
  tabActiva = signal<'ingredientes' | 'platillos' | 'movimientos' | 'promociones'>('ingredientes');
  cargando = signal<boolean>(false);
  guardando = signal<boolean>(false);
  mensajeExito = signal<string>('');
  mensajeError = signal<string>('');

  ingredientes = signal<IngredienteDTO[]>([]);
  platillos = signal<PlatilloDTO[]>([]);
  movimientos = signal<MovimientoInventarioDTO[]>([]);
  promociones = signal<PromocionDTO[]>([]);

  // Modales Promociones
  mostrarModalPromocion = signal<boolean>(false);
  modoEdicionPromocion = signal<boolean>(false);
  promocionSeleccionadaId = signal<number | null>(null);
  formPromocion = {
    nombre: '',
    platilloId: 0,
    tipo: 'PORCENTAJE' as TipoPromocion,
    porcentaje: '15',
    n: 2,
    m: 1,
    duracion: 'PERMANENTE' as DuracionPromocion,
    fechaInicioLocal: '',
    fechaFinLocal: ''
  };

  // Modales
  mostrarModalIngrediente = signal<boolean>(false);
  modoEdicionIngrediente = signal<boolean>(false);
  ingredienteSeleccionadoId = signal<number | null>(null);
  formIngrediente = {
    nombre: '',
    unidad: 'g' as UnidadIngrediente,
    minimo: '0',
    activo: true
  };

  mostrarModalPlatillo = signal<boolean>(false);
  modoEdicionPlatillo = signal<boolean>(false);
  platilloSeleccionadoId = signal<number | null>(null);
  formPlatillo = {
    nombre: '',
    precio: '',
    activo: true,
    receta: [] as Array<{ ingredienteId: number; cantidad: string | number }>
  };

  mostrarModalEntrada = signal<boolean>(false);
  formEntrada = {
    ingredienteId: 0,
    cantidad: '',
    motivo: ''
  };

  mostrarModalAjuste = signal<boolean>(false);
  formAjuste = {
    ingredienteId: 0,
    cantidad: '',
    motivo: ''
  };

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando.set(true);
    this.api.listarIngredientes().subscribe({
      next: (ings) => {
        this.ingredientes.set(ings);
        this.cargando.set(false);
      },
      error: (err) => {
        this.mostrarError('Error al cargar insumos: ' + (err.error?.mensaje || err.message));
        this.cargando.set(false);
      }
    });

    this.api.listarPlatillosAdmin().subscribe({
      next: (plats) => this.platillos.set(plats),
      error: () => {}
    });

    this.api.listarMovimientos().subscribe({
      next: (movs) => this.movimientos.set(movs),
      error: () => {}
    });

    this.promocionesApi.listarPromociones().subscribe({
      next: (promos) => this.promociones.set(promos),
      error: () => {}
    });
  }

  ingredientesActivos(): IngredienteDTO[] {
    return this.ingredientes().filter((i) => i.activo);
  }

  platillosActivos(): PlatilloDTO[] {
    return this.platillos().filter((p) => p.activo);
  }

  // --- ACCIONES INGREDIENTE ---
  abrirModalIngrediente(): void {
    this.modoEdicionIngrediente.set(false);
    this.ingredienteSeleccionadoId.set(null);
    this.formIngrediente = {
      nombre: '',
      unidad: 'g',
      minimo: '0',
      activo: true
    };
    this.mostrarModalIngrediente.set(true);
  }

  editarIngrediente(ing: IngredienteDTO): void {
    this.modoEdicionIngrediente.set(true);
    this.ingredienteSeleccionadoId.set(ing.id);
    this.formIngrediente = {
      nombre: ing.nombre,
      unidad: ing.unidad,
      minimo: ing.minimo,
      activo: ing.activo
    };
    this.mostrarModalIngrediente.set(true);
  }

  guardarIngrediente(): void {
    if (!this.formIngrediente.nombre.trim()) {
      this.mostrarError('El nombre del insumo es obligatorio.');
      return;
    }

    this.guardando.set(true);
    if (this.modoEdicionIngrediente() && this.ingredienteSeleccionadoId()) {
      this.api.actualizarIngrediente(this.ingredienteSeleccionadoId()!, {
        nombre: this.formIngrediente.nombre,
        unidad: this.formIngrediente.unidad,
        minimo: this.formIngrediente.minimo,
        activo: this.formIngrediente.activo
      }).subscribe({
        next: () => {
          this.mostrarExito('Insumo actualizado con éxito.');
          this.cerrarModales();
          this.cargarDatos();
        },
        error: (err) => {
          this.mostrarError(err.error?.mensaje || 'Error al actualizar insumo.');
          this.guardando.set(false);
        }
      });
    } else {
      this.api.crearIngrediente({
        nombre: this.formIngrediente.nombre,
        unidad: this.formIngrediente.unidad,
        minimo: this.formIngrediente.minimo
      }).subscribe({
        next: () => {
          this.mostrarExito('Insumo registrado con éxito.');
          this.cerrarModales();
          this.cargarDatos();
        },
        error: (err) => {
          this.mostrarError(err.error?.mensaje || 'Error al registrar insumo.');
          this.guardando.set(false);
        }
      });
    }
  }

  // --- ACCIONES PLATILLO Y RECETA ---
  abrirModalPlatillo(): void {
    this.modoEdicionPlatillo.set(false);
    this.platilloSeleccionadoId.set(null);
    this.formPlatillo = {
      nombre: '',
      precio: '',
      activo: true,
      receta: [{ ingredienteId: 0, cantidad: '' }]
    };
    this.mostrarModalPlatillo.set(true);
  }

  editarPlatillo(plat: PlatilloDTO): void {
    this.modoEdicionPlatillo.set(true);
    this.platilloSeleccionadoId.set(plat.id);
    this.formPlatillo = {
      nombre: plat.nombre,
      precio: plat.precio,
      activo: plat.activo,
      receta: (plat.ingredientes || []).map((i) => ({
        ingredienteId: i.ingredienteId,
        cantidad: i.cantidad
      }))
    };
    if (this.formPlatillo.receta.length === 0) {
      this.formPlatillo.receta.push({ ingredienteId: 0, cantidad: '' });
    }
    this.mostrarModalPlatillo.set(true);
  }

  agregarFilaReceta(): void {
    this.formPlatillo.receta.push({ ingredienteId: 0, cantidad: '' });
  }

  removerFilaReceta(index: number): void {
    if (this.formPlatillo.receta.length > 1) {
      this.formPlatillo.receta.splice(index, 1);
    } else {
      this.mostrarError('La receta debe conservar al menos un insumo.');
    }
  }

  guardarPlatillo(): void {
    if (!this.formPlatillo.nombre.trim()) {
      this.mostrarError('El nombre del platillo es obligatorio.');
      return;
    }
    if (!this.formPlatillo.precio || Number(this.formPlatillo.precio) <= 0) {
      this.mostrarError('El precio debe ser un importe positivo mayor a cero.');
      return;
    }

    const recetaLimpia = this.formPlatillo.receta.filter((r) => r.ingredienteId > 0 && Number(r.cantidad) > 0);
    if (recetaLimpia.length === 0) {
      this.mostrarError('Debes agregar al menos un insumo con cantidad válida en la receta.');
      return;
    }

    this.guardando.set(true);
    if (this.modoEdicionPlatillo() && this.platilloSeleccionadoId()) {
      this.api.actualizarPlatillo(this.platilloSeleccionadoId()!, {
        nombre: this.formPlatillo.nombre,
        precio: this.formPlatillo.precio,
        activo: this.formPlatillo.activo,
        receta: recetaLimpia
      }).subscribe({
        next: () => {
          this.mostrarExito('Platillo y receta actualizados exitosamente.');
          this.cerrarModales();
          this.cargarDatos();
        },
        error: (err) => {
          this.mostrarError(err.error?.mensaje || 'Error al actualizar platillo.');
          this.guardando.set(false);
        }
      });
    } else {
      this.api.crearPlatillo({
        nombre: this.formPlatillo.nombre,
        precio: this.formPlatillo.precio,
        receta: recetaLimpia
      }).subscribe({
        next: () => {
          this.mostrarExito('Platillo creado exitosamente.');
          this.cerrarModales();
          this.cargarDatos();
        },
        error: (err) => {
          this.mostrarError(err.error?.mensaje || 'Error al crear platillo.');
          this.guardando.set(false);
        }
      });
    }
  }

  // --- ACCIONES ENTRADA Y AJUSTE ---
  abrirModalEntrada(): void {
    this.formEntrada = {
      ingredienteId: this.ingredientesActivos()[0]?.id || 0,
      cantidad: '',
      motivo: ''
    };
    this.mostrarModalEntrada.set(true);
  }

  guardarEntrada(): void {
    if (!this.formEntrada.ingredienteId) {
      this.mostrarError('Selecciona un insumo.');
      return;
    }
    if (!this.formEntrada.cantidad || Number(this.formEntrada.cantidad) <= 0) {
      this.mostrarError('La cantidad de entrada debe ser mayor a cero.');
      return;
    }

    this.guardando.set(true);
    this.api.registrarEntrada({
      ingredienteId: this.formEntrada.ingredienteId,
      cantidad: this.formEntrada.cantidad,
      motivo: this.formEntrada.motivo
    }).subscribe({
      next: () => {
        this.mostrarExito('Entrada registrada exitosamente.');
        this.cerrarModales();
        this.cargarDatos();
      },
      error: (err) => {
        this.mostrarError(err.error?.mensaje || 'Error al registrar entrada.');
        this.guardando.set(false);
      }
    });
  }

  abrirModalAjuste(): void {
    this.formAjuste = {
      ingredienteId: this.ingredientesActivos()[0]?.id || 0,
      cantidad: '',
      motivo: ''
    };
    this.mostrarModalAjuste.set(true);
  }

  guardarAjuste(): void {
    if (!this.formAjuste.ingredienteId) {
      this.mostrarError('Selecciona un insumo.');
      return;
    }
    if (!this.formAjuste.cantidad || Number(this.formAjuste.cantidad) === 0) {
      this.mostrarError('La cantidad de ajuste no puede ser cero.');
      return;
    }
    if (!this.formAjuste.motivo.trim()) {
      this.mostrarError('El motivo justificado es obligatorio.');
      return;
    }

    this.guardando.set(true);
    this.api.registrarAjuste({
      ingredienteId: this.formAjuste.ingredienteId,
      cantidad: this.formAjuste.cantidad,
      motivo: this.formAjuste.motivo
    }).subscribe({
      next: () => {
        this.mostrarExito('Ajuste de inventario aplicado exitosamente.');
        this.cerrarModales();
        this.cargarDatos();
      },
      error: (err) => {
        this.mostrarError(err.error?.mensaje || 'Error al aplicar ajuste.');
        this.guardando.set(false);
      }
    });
  }

  // --- ACCIONES PROMOCIONES ---
  abrirModalPromocion(): void {
    this.modoEdicionPromocion.set(false);
    this.promocionSeleccionadaId.set(null);
    const ahora = new Date();
    const manana = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const isoLocal = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    this.formPromocion = {
      nombre: '',
      platilloId: this.platillosActivos().length > 0 ? this.platillosActivos()[0].id : 0,
      tipo: 'PORCENTAJE',
      porcentaje: '15',
      n: 2,
      m: 1,
      duracion: 'PERMANENTE',
      fechaInicioLocal: isoLocal(ahora),
      fechaFinLocal: isoLocal(manana)
    };
    this.mostrarModalPromocion.set(true);
  }

  abrirModalEditarPromocion(promo: PromocionDTO): void {
    this.modoEdicionPromocion.set(true);
    this.promocionSeleccionadaId.set(promo.id);

    const pad = (n: number) => n.toString().padStart(2, '0');
    const isoLocal = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    this.formPromocion = {
      nombre: promo.nombre,
      platilloId: promo.platilloId,
      tipo: promo.tipo,
      porcentaje: promo.porcentaje || '15',
      n: promo.n || 2,
      m: promo.m || 1,
      duracion: promo.duracion,
      fechaInicioLocal: promo.fechaInicio ? isoLocal(new Date(promo.fechaInicio)) : '',
      fechaFinLocal: promo.fechaFin ? isoLocal(new Date(promo.fechaFin)) : ''
    };
    this.mostrarModalPromocion.set(true);
  }

  guardarPromocion(): void {
    if (!this.formPromocion.nombre.trim()) {
      this.mostrarError('El nombre de la promoción es obligatorio.');
      return;
    }
    if (!this.formPromocion.platilloId || this.formPromocion.platilloId <= 0) {
      this.mostrarError('Debes seleccionar un platillo participante.');
      return;
    }

    let payload: any = {
      nombre: this.formPromocion.nombre.trim(),
      platilloId: this.formPromocion.platilloId,
      tipo: this.formPromocion.tipo,
      duracion: this.formPromocion.duracion
    };

    if (this.formPromocion.tipo === 'PORCENTAJE') {
      const p = Number(this.formPromocion.porcentaje);
      if (isNaN(p) || p <= 0 || p > 100) {
        this.mostrarError('El porcentaje debe ser un número entre 0.01 y 100.');
        return;
      }
      payload.porcentaje = this.formPromocion.porcentaje;
    } else {
      const n = Number(this.formPromocion.n);
      const m = Number(this.formPromocion.m);
      if (!Number.isInteger(n) || !Number.isInteger(m) || m < 1 || n <= m) {
        this.mostrarError('Para promociones NxM debe cumplirse que N y M sean enteros con N > M >= 1.');
        return;
      }
      payload.n = n;
      payload.m = m;
    }

    if (this.formPromocion.duracion === 'TEMPORAL') {
      if (!this.formPromocion.fechaInicioLocal || !this.formPromocion.fechaFinLocal) {
        this.mostrarError('Las promociones temporales requieren fecha y hora de inicio y fin.');
        return;
      }
      const ini = new Date(this.formPromocion.fechaInicioLocal);
      const fin = new Date(this.formPromocion.fechaFinLocal);
      if (isNaN(ini.getTime()) || isNaN(fin.getTime()) || ini.getTime() >= fin.getTime()) {
        this.mostrarError('La fecha de inicio debe ser anterior a la fecha de fin.');
        return;
      }
      payload.fechaInicio = ini.toISOString();
      payload.fechaFin = fin.toISOString();
    }

    this.guardando.set(true);
    if (this.modoEdicionPromocion() && this.promocionSeleccionadaId()) {
      this.promocionesApi.actualizarPromocion(this.promocionSeleccionadaId()!, payload).subscribe({
        next: () => {
          this.mostrarExito('Promoción actualizada exitosamente.');
          this.cerrarModales();
          this.cargarDatos();
        },
        error: (err) => {
          this.mostrarError(err.error?.mensaje || 'Error al actualizar promoción.');
          this.guardando.set(false);
        }
      });
    } else {
      this.promocionesApi.crearPromocion(payload).subscribe({
        next: () => {
          this.mostrarExito('Promoción creada exitosamente.');
          this.cerrarModales();
          this.cargarDatos();
        },
        error: (err) => {
          this.mostrarError(err.error?.mensaje || 'Error al crear promoción.');
          this.guardando.set(false);
        }
      });
    }
  }

  conmutarEstadoPromocion(promo: PromocionDTO): void {
    const nuevoEstado = promo.estado === 'ACTIVA' ? 'INACTIVA' : 'ACTIVA';
    this.guardando.set(true);
    this.promocionesApi.cambiarEstado(promo.id, nuevoEstado).subscribe({
      next: () => {
        this.mostrarExito(`Promoción ${nuevoEstado === 'ACTIVA' ? 'activada' : 'pausada'} con éxito.`);
        this.guardando.set(false);
        this.cargarDatos();
      },
      error: (err) => {
        this.mostrarError(err.error?.mensaje || 'Error al cambiar estado.');
        this.guardando.set(false);
      }
    });
  }

  confirmarRetiroPromocion(promo: PromocionDTO): void {
    const seguro = confirm(
      `¿Confirmas el retiro definitivo de la promoción '${promo.nombre}'?\n\nEsta acción es una baja lógica inmutable: la regla se conserva en el historial pero no podrá volver a activarse ni aplicarse en ventas futuras.`
    );
    if (!seguro) return;

    this.guardando.set(true);
    this.promocionesApi.retirarPromocion(promo.id).subscribe({
      next: () => {
        this.mostrarExito('Promoción retirada definitivamente.');
        this.guardando.set(false);
        this.cargarDatos();
      },
      error: (err) => {
        this.mostrarError(err.error?.mensaje || 'Error al retirar promoción.');
        this.guardando.set(false);
      }
    });
  }

  cerrarModales(): void {
    this.mostrarModalIngrediente.set(false);
    this.mostrarModalPlatillo.set(false);
    this.mostrarModalEntrada.set(false);
    this.mostrarModalAjuste.set(false);
    this.mostrarModalPromocion.set(false);
    this.guardando.set(false);
  }

  formatearFecha(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private mostrarExito(msj: string): void {
    this.mensajeExito.set(msj);
    this.mensajeError.set('');
    setTimeout(() => this.mensajeExito.set(''), 4000);
  }

  private mostrarError(msj: string): void {
    this.mensajeError.set(msj);
    this.mensajeExito.set('');
    setTimeout(() => this.mensajeError.set(''), 6000);
  }
}
