import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { ResultadoCotizacionDTO } from './promociones.service';

export type EstadoOrden = 'CONFIRMADA' | 'ANULADA';
export type MetodoPago = 'EFECTIVO' | 'EXTERNO' | 'SIN_COBRO';

export interface PartidaOrdenDTO {
  id: number;
  platilloId: number;
  nombrePlatillo: string;
  precioUnitario: string;
  cantidad: number;
  unidadesCobradas: number;
  unidadesBonificadas: number;
  subtotalBruto: string;
  descuento: string;
  subtotalNeto: string;
  promocionId: number | null;
}

export interface PromocionSnapshotDTO {
  id: number | null;
  nombre: string | null;
  tipo: string | null;
  ahorro: string | null;
}

export interface OrdenDTO {
  id: number;
  folio: string;
  claveIdempotencia: string;
  usuarioId: number;
  nombreCajero: string;
  estado: EstadoOrden;
  metodoPago: MetodoPago;
  subtotalBruto: string;
  descuentoTotal: string;
  total: string;
  promocion: PromocionSnapshotDTO | null;
  partidas: PartidaOrdenDTO[];
  motivoAnulacion: string | null;
  usuarioAnulacionId: number | null;
  nombreUsuarioAnulacion: string | null;
  anuladoEn: string | null;
  creadoEn: string;
}

export interface ItemVentaInput {
  platilloId: number;
  cantidad: number;
}

export interface ConfirmarVentaInput {
  claveIdempotencia: string;
  metodoPago: MetodoPago;
  items: ItemVentaInput[];
  cotizacionAceptada: ResultadoCotizacionDTO;
}

export interface ResumenPeriodoVentasDTO {
  fechaInicio: string | null;
  fechaFin: string | null;
  cantidadConfirmadas: number;
  cantidadAnuladas: number;
  totalVentasConfirmadas: string;
  ordenes: OrdenDTO[];
}

@Injectable({
  providedIn: 'root'
})
export class VentasApiService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private readonly baseUrl = '/api/v1/ventas';

  private getOptions() {
    let csrf = this.authService.csrfToken();
    if (!csrf && typeof document !== 'undefined') {
      const match = document.cookie.match(/asmibuy_csrf=([^;]+)/);
      if (match) {
        csrf = match[1];
        this.authService.csrfToken.set(csrf);
      }
    }

    return {
      withCredentials: true,
      headers: new HttpHeaders({
        'X-CSRF-Token': csrf || ''
      })
    };
  }

  /**
   * Confirma una orden de venta de forma atómica (CW-05, CW-06, CW-07, CW-14, CW-15)
   */
  confirmarVenta(data: ConfirmarVentaInput): Observable<OrdenDTO> {
    return this.http.post<OrdenDTO>(`${this.baseUrl}/confirmar`, data, this.getOptions());
  }

  /**
   * Consulta si una venta pendiente fue procesada tras una pérdida de red o timeout (CW-19)
   */
  recuperarVenta(claveIdempotencia: string): Observable<{ encontrada: boolean; orden: OrdenDTO | null }> {
    return this.http.get<{ encontrada: boolean; orden: OrdenDTO | null }>(
      `${this.baseUrl}/recuperar/${encodeURIComponent(claveIdempotencia)}`,
      { withCredentials: true }
    );
  }

  /**
   * Consulta el historial de ventas del turno/periodo según el rol del usuario (CW-02, CW-15, CW-16)
   */
  listarHistorial(filtro?: { fechaInicio?: string; fechaFin?: string }): Observable<ResumenPeriodoVentasDTO> {
    let url = `${this.baseUrl}/historial`;
    const params: string[] = [];
    if (filtro?.fechaInicio) {
      params.push(`fechaInicio=${encodeURIComponent(filtro.fechaInicio)}`);
    }
    if (filtro?.fechaFin) {
      params.push(`fechaFin=${encodeURIComponent(filtro.fechaFin)}`);
    }
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }
    return this.http.get<ResumenPeriodoVentasDTO>(url, { withCredentials: true });
  }

  /**
   * Consulta el detalle histórico y comprobante de una orden por su identificador
   */
  obtenerOrdenPorId(id: number): Observable<OrdenDTO> {
    return this.http.get<OrdenDTO>(`${this.baseUrl}/${id}`, { withCredentials: true });
  }

  /**
   * Anula una orden de venta con motivo obligatorio (Exclusivo Administrador - CW-02, CW-16)
   */
  anularVenta(id: number, motivo: string): Observable<OrdenDTO> {
    return this.http.post<OrdenDTO>(
      `${this.baseUrl}/${id}/anular`,
      { motivo },
      this.getOptions()
    );
  }
}
