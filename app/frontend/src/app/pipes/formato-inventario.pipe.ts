import { Pipe, PipeTransform } from '@angular/core';

/**
 * Texto legible para los códigos de estado/tipo que envía la API (H-10).
 * Uso: {{ ing.estadoStock | etiquetaEstado }} → «Bajo stock»
 */
const ETIQUETAS: Record<string, string> = {
  NORMAL: 'Normal',
  BAJO_STOCK: 'Bajo stock',
  AGOTADO: 'Agotado',
  ENTRADA: 'Entrada',
  AJUSTE: 'Ajuste',
  CONSUMO_VENTA: 'Consumo por venta'
};

@Pipe({ name: 'etiquetaEstado', standalone: true })
export class EtiquetaEstadoPipe implements PipeTransform {
  transform(codigo: string | null | undefined): string {
    if (!codigo) return '';
    return ETIQUETAS[codigo] ?? codigo.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  }
}

/**
 * Cantidad legible con su unidad (H-10): sin ceros decimales sobrantes,
 * con separador de miles y plural de «pieza».
 * Conserva el signo «+» explícito de los movimientos de entrada.
 * Uso: {{ ing.existencia | cantidad: ing.unidad }} → «8,000 g», «1 pieza», «300 piezas»
 * Sólo formatea para mostrar; los cálculos siguen usando las cadenas decimales de la API.
 */
@Pipe({ name: 'cantidad', standalone: true })
export class CantidadPipe implements PipeTransform {
  private readonly formato = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 });

  transform(valor: string | number | null | undefined, unidad?: string | null): string {
    if (valor === null || valor === undefined || valor === '') return '';
    const texto = String(valor).trim();
    const numero = Number(texto);
    if (!Number.isFinite(numero)) return unidad ? `${texto} ${unidad}` : texto;

    const signo = texto.startsWith('+') && numero > 0 ? '+' : '';
    const cifra = signo + this.formato.format(numero);
    if (!unidad) return cifra;
    const unidadFinal = unidad === 'pieza' && Math.abs(numero) !== 1 ? 'piezas' : unidad;
    return `${cifra} ${unidadFinal}`;
  }
}
