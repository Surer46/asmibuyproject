import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export type TipoPromocion = 'PORCENTAJE' | 'NXM';
export type DuracionPromocion = 'TEMPORAL' | 'PERMANENTE';
export type EstadoPromocion = 'ACTIVA' | 'INACTIVA' | 'RETIRADA';

export interface PromocionDTO {
  id: number;
  nombre: string;
  platilloId: number;
  nombrePlatillo: string;
  precioPlatillo: string;
  tipo: TipoPromocion;
  porcentaje: string | null;
  n: number | null;
  m: number | null;
  duracion: DuracionPromocion;
  fechaInicio: string | null;
  fechaFin: string | null;
  estado: EstadoPromocion;
  vigente: boolean;
  usuarioId: number;
  creadoEn: string;
  actualizadoEn: string;
}

export interface CrearPromocionInput {
  nombre: string;
  platilloId: number;
  tipo: TipoPromocion;
  porcentaje?: string | number | null;
  n?: number | null;
  m?: number | null;
  duracion: DuracionPromocion;
  fechaInicio?: string | null;
  fechaFin?: string | null;
}

export interface ActualizarPromocionInput {
  nombre?: string;
  platilloId?: number;
  tipo?: TipoPromocion;
  porcentaje?: string | number | null;
  n?: number | null;
  m?: number | null;
  duracion?: DuracionPromocion;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  estado?: EstadoPromocion;
}

export interface ItemCotizacionInput {
  platilloId: number;
  cantidad: number;
}

export interface PartidaCotizacionDTO {
  platilloId: number;
  nombrePlatillo: string;
  precioUnitario: string;
  cantidad: number;
  subtotalBruto: string;
  descuento: string;
  subtotalNeto: string;
  unidadesCobradas: number;
  unidadesBonificadas: number;
  promocionAplicadaId: number | null;
}

export interface PromocionAplicadaSnapshotDTO {
  id: number;
  nombre: string;
  tipo: TipoPromocion;
  porcentaje: string | null;
  n: number | null;
  m: number | null;
  duracion: DuracionPromocion;
  ahorroTotal: string;
}

export interface ResultadoCotizacionDTO {
  subtotalBruto: string;
  descuentoTotal: string;
  total: string;
  promocionAplicada: PromocionAplicadaSnapshotDTO | null;
  partidas: PartidaCotizacionDTO[];
  fechaEvaluacion: string;
}

@Injectable({
  providedIn: 'root'
})
export class PromocionesApiService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private readonly baseUrl = '/api/v1';

  private getOptions() {
    const csrf = this.authService.csrfToken();
    return {
      withCredentials: true,
      headers: new HttpHeaders({
        'X-CSRF-Token': csrf || ''
      })
    };
  }

  listarPromociones(): Observable<PromocionDTO[]> {
    return this.http.get<PromocionDTO[]>(`${this.baseUrl}/promociones`, { withCredentials: true });
  }

  obtenerPromocion(id: number): Observable<PromocionDTO> {
    return this.http.get<PromocionDTO>(`${this.baseUrl}/promociones/${id}`, { withCredentials: true });
  }

  crearPromocion(data: CrearPromocionInput): Observable<PromocionDTO> {
    return this.http.post<PromocionDTO>(`${this.baseUrl}/promociones`, data, this.getOptions());
  }

  actualizarPromocion(id: number, data: ActualizarPromocionInput): Observable<PromocionDTO> {
    return this.http.put<PromocionDTO>(`${this.baseUrl}/promociones/${id}`, data, this.getOptions());
  }

  cambiarEstado(id: number, estado: EstadoPromocion): Observable<PromocionDTO> {
    return this.http.patch<PromocionDTO>(`${this.baseUrl}/promociones/${id}/estado`, { estado }, this.getOptions());
  }

  retirarPromocion(id: number): Observable<PromocionDTO> {
    return this.http.delete<PromocionDTO>(`${this.baseUrl}/promociones/${id}`, this.getOptions());
  }

  cotizarOrden(items: ItemCotizacionInput[]): Observable<ResultadoCotizacionDTO> {
    return this.http.post<ResultadoCotizacionDTO>(`${this.baseUrl}/promociones/cotizar`, { items }, this.getOptions());
  }

  validarCotizacion(cotizacionPrevia: ResultadoCotizacionDTO): Observable<{ valida: boolean; cotizacion: ResultadoCotizacionDTO }> {
    return this.http.post<{ valida: boolean; cotizacion: ResultadoCotizacionDTO }>(
      `${this.baseUrl}/promociones/validar-cotizacion`,
      cotizacionPrevia,
      this.getOptions()
    );
  }
}
