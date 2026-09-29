import Decimal from 'decimal.js';

export type UnidadIngrediente = 'g' | 'ml' | 'pieza';
export type TipoMovimiento = 'ENTRADA' | 'AJUSTE' | 'CONSUMO_VENTA';
export type EstadoStock = 'NORMAL' | 'BAJO_STOCK' | 'AGOTADO';

export interface IngredienteInterno {
  id: number;
  nombre: string;
  unidad: UnidadIngrediente;
  minimo: Decimal;
  activo: boolean;
}

export interface PlatilloInterno {
  id: number;
  nombre: string;
  precio: Decimal;
  activo: boolean;
}

export interface RecetaDetalleInterno {
  platilloId: number;
  ingredienteId: number;
  cantidad: Decimal;
}

export interface MovimientoInterno {
  id: number;
  ingredienteId: number;
  tipo: TipoMovimiento;
  cantidad: Decimal;
  motivo: string;
  usuarioId: number;
  ordenId?: number | null;
  creadoEn: Date;
}

export const almacenMemoria = {
  ingredientes: [
    { id: 1, nombre: 'Pan de Hamburguesa', unidad: 'pieza' as UnidadIngrediente, minimo: new Decimal(20), activo: true },
    { id: 2, nombre: 'Carne de Res', unidad: 'g' as UnidadIngrediente, minimo: new Decimal(2000), activo: true },
    { id: 3, nombre: 'Queso Amarillo', unidad: 'pieza' as UnidadIngrediente, minimo: new Decimal(15), activo: true },
    { id: 4, nombre: 'Papas Congeladas', unidad: 'g' as UnidadIngrediente, minimo: new Decimal(1000), activo: true }
  ] as IngredienteInterno[],

  platillos: [
    { id: 1, nombre: 'Hamburguesa Clásica', precio: new Decimal('120.00'), activo: true }
  ] as PlatilloInterno[],

  recetas: [
    { platilloId: 1, ingredienteId: 1, cantidad: new Decimal(1) },
    { platilloId: 1, ingredienteId: 2, cantidad: new Decimal(150) },
    { platilloId: 1, ingredienteId: 3, cantidad: new Decimal(1) }
  ] as RecetaDetalleInterno[],

  movimientos: [
    { id: 1, ingredienteId: 1, tipo: 'ENTRADA' as TipoMovimiento, cantidad: new Decimal(50), motivo: 'Stock inicial', usuarioId: 1, creadoEn: new Date() },
    { id: 2, ingredienteId: 2, tipo: 'ENTRADA' as TipoMovimiento, cantidad: new Decimal(5000), motivo: 'Stock inicial', usuarioId: 1, creadoEn: new Date() },
    { id: 3, ingredienteId: 3, tipo: 'ENTRADA' as TipoMovimiento, cantidad: new Decimal(40), motivo: 'Stock inicial', usuarioId: 1, creadoEn: new Date() }
  ] as MovimientoInterno[],

  promociones: [] as PromocionInterna[],

  ordenes: [] as OrdenInterna[],
  ordenDetalles: [] as PartidaOrdenInterna[],

  proxIngredienteId: 5,
  proxPlatilloId: 2,
  proxMovimientoId: 4,
  proxPromocionId: 1,
  proxOrdenId: 1,
  proxOrdenDetalleId: 1
};

export type TipoPromocion = 'PORCENTAJE' | 'NXM';
export type DuracionPromocion = 'TEMPORAL' | 'PERMANENTE';
export type EstadoPromocion = 'ACTIVA' | 'INACTIVA' | 'RETIRADA';

export interface PromocionInterna {
  id: number;
  nombre: string;
  platilloId: number;
  tipo: TipoPromocion;
  porcentaje: Decimal | null;
  n: number | null;
  m: number | null;
  duracion: DuracionPromocion;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  estado: EstadoPromocion;
  usuarioId: number;
  creadoEn: Date;
  actualizadoEn: Date;
}

export type EstadoOrden = 'CONFIRMADA' | 'ANULADA';
export type MetodoPago = 'EFECTIVO' | 'EXTERNO' | 'SIN_COBRO';

export interface PartidaOrdenInterna {
  id: number;
  ordenId: number;
  platilloId: number;
  nombrePlatillo: string;
  precioUnitario: Decimal;
  cantidad: number;
  unidadesCobradas: number;
  unidadesBonificadas: number;
  subtotalBruto: Decimal;
  descuento: Decimal;
  subtotalNeto: Decimal;
  promocionId: number | null;
  creadoEn: Date;
}

export interface OrdenInterna {
  id: number;
  folio: string;
  claveIdempotencia: string;
  usuarioId: number;
  estado: EstadoOrden;
  metodoPago: MetodoPago;
  subtotalBruto: Decimal;
  descuentoTotal: Decimal;
  total: Decimal;
  promocionId: number | null;
  promocionNombre: string | null;
  promocionTipo: string | null;
  promocionAhorro: Decimal | null;
  motivoAnulacion: string | null;
  usuarioAnulacionId: number | null;
  anuladoEn: Date | null;
  creadoEn: Date;
  actualizadoEn: Date;
}


