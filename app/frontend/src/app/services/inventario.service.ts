import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export type UnidadIngrediente = 'g' | 'ml' | 'pieza';
export type TipoMovimiento = 'ENTRADA' | 'AJUSTE' | 'CONSUMO_VENTA';
export type EstadoStock = 'NORMAL' | 'BAJO_STOCK' | 'AGOTADO';

export interface IngredienteDTO {
  id: number;
  nombre: string;
  unidad: UnidadIngrediente;
  minimo: string;
  existencia: string;
  estadoStock: EstadoStock;
  activo: boolean;
}

export interface IngredienteRecetaDTO {
  ingredienteId: number;
  nombreIngrediente: string;
  unidad: UnidadIngrediente;
  cantidad: string;
}

export interface PlatilloDTO {
  id: number;
  nombre: string;
  precio: string;
  activo: boolean;
  recetaValida: boolean;
  ingredientes?: IngredienteRecetaDTO[];
}

export interface MovimientoInventarioDTO {
  id: number;
  ingredienteId: number;
  nombreIngrediente: string;
  unidad: UnidadIngrediente;
  tipo: TipoMovimiento;
  cantidad: string;
  motivo: string;
  usuarioId: number;
  nombreUsuario: string;
  ordenId?: number | null;
  creadoEn: string;
}

export interface AvisoStockDTO {
  ingredienteId: number;
  nombre: string;
  unidad: UnidadIngrediente;
  existencia: string;
  minimo: string;
  estadoStock: EstadoStock;
}

export interface CrearIngredienteInput {
  nombre: string;
  unidad: UnidadIngrediente;
  minimo: string | number;
}

export interface ActualizarIngredienteInput {
  nombre?: string;
  unidad?: UnidadIngrediente;
  minimo?: string | number;
  activo?: boolean;
}

export interface CrearPlatilloInput {
  nombre: string;
  precio: string | number;
  receta: Array<{ ingredienteId: number; cantidad: string | number }>;
}

export interface ActualizarPlatilloInput {
  nombre?: string;
  precio?: string | number;
  activo?: boolean;
  receta?: Array<{ ingredienteId: number; cantidad: string | number }>;
}

export interface RegistrarEntradaInput {
  ingredienteId: number;
  cantidad: string | number;
  motivo?: string;
}

export interface RegistrarAjusteInput {
  ingredienteId: number;
  cantidad: string | number;
  motivo: string;
}

@Injectable({
  providedIn: 'root'
})
export class InventarioApiService {
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

  // --- INGREDIENTES ---
  listarIngredientes(): Observable<IngredienteDTO[]> {
    return this.http.get<IngredienteDTO[]>(`${this.baseUrl}/admin/ingredientes`, { withCredentials: true });
  }

  crearIngrediente(data: CrearIngredienteInput): Observable<IngredienteDTO> {
    return this.http.post<IngredienteDTO>(`${this.baseUrl}/admin/ingredientes`, data, this.getOptions());
  }

  actualizarIngrediente(id: number, data: ActualizarIngredienteInput): Observable<IngredienteDTO> {
    return this.http.put<IngredienteDTO>(`${this.baseUrl}/admin/ingredientes/${id}`, data, this.getOptions());
  }

  // --- PLATILLOS Y RECETAS ---
  listarPlatillosAdmin(): Observable<PlatilloDTO[]> {
    return this.http.get<PlatilloDTO[]>(`${this.baseUrl}/admin/platillos`, { withCredentials: true });
  }

  listarPlatillosPublicos(): Observable<PlatilloDTO[]> {
    return this.http.get<PlatilloDTO[]>(`${this.baseUrl}/catalogo/platillos`, { withCredentials: true });
  }

  crearPlatillo(data: CrearPlatilloInput): Observable<PlatilloDTO> {
    return this.http.post<PlatilloDTO>(`${this.baseUrl}/admin/platillos`, data, this.getOptions());
  }

  actualizarPlatillo(id: number, data: ActualizarPlatilloInput): Observable<PlatilloDTO> {
    return this.http.put<PlatilloDTO>(`${this.baseUrl}/admin/platillos/${id}`, data, this.getOptions());
  }

  // --- MOVIMIENTOS ---
  listarMovimientos(ingredienteId?: number): Observable<MovimientoInventarioDTO[]> {
    let url = `${this.baseUrl}/admin/movimientos`;
    if (ingredienteId) {
      url += `?ingredienteId=${ingredienteId}`;
    }
    return this.http.get<MovimientoInventarioDTO[]>(url, { withCredentials: true });
  }

  registrarEntrada(data: RegistrarEntradaInput): Observable<MovimientoInventarioDTO> {
    return this.http.post<MovimientoInventarioDTO>(`${this.baseUrl}/admin/movimientos/entrada`, data, this.getOptions());
  }

  registrarAjuste(data: RegistrarAjusteInput): Observable<MovimientoInventarioDTO> {
    return this.http.post<MovimientoInventarioDTO>(`${this.baseUrl}/admin/movimientos/ajuste`, data, this.getOptions());
  }

  // --- AVISOS DE INVENTARIO (CW-08 / CW-09) ---
  obtenerAvisos(): Observable<AvisoStockDTO[]> {
    return this.http.get<AvisoStockDTO[]>(`${this.baseUrl}/inventario/avisos`, { withCredentials: true });
  }
}
