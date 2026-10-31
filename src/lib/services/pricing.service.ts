export interface DescuentoInfo {
  porcentajeDesc: number;
  fechaInicioDesc: Date | string;
  fechaFinDesc: Date | string;
  fechaHoraBajaDesc?: Date | string | null;
}

/**
 * Calcula el precio de venta sugerido aplicando el porcentaje de markup al precio de costo.
 * Fórmula: PrecioVenta = PrecioCosto * (1 + porcentajeMarkup / 100)
 */
export function calcularPrecioSugerido(precioCosto: number, porcentajeMarkup: number): number {
  if (precioCosto <= 0) return 0;
  return Math.round(precioCosto * (1 + porcentajeMarkup / 100));
}

/**
 * Calcula el coeficiente multiplicador de reventa (ej: 120% markup -> 2.20x)
 */
export function calcularCoeficienteReventa(porcentajeMarkup: number): number {
  return Number((1 + porcentajeMarkup / 100).toFixed(2));
}

/**
 * Cuando la dueña modifica manualmente el precio final para redondeo comercial,
 * recalcula el porcentaje de markup resultante.
 */
export function calcularMarkupReverso(precioCosto: number, precioVentaFinal: number): number {
  if (precioCosto <= 0) return 0;
  const markup = (precioVentaFinal / precioCosto - 1) * 100;
  return Number(markup.toFixed(2));
}

/**
 * Verifica si un descuento se encuentra vigente en la fecha indicada.
 */
export function obtenerPorcentajeDescuentoVigente(
  descuento?: DescuentoInfo | null,
  fechaActual: Date = new Date()
): number {
  if (!descuento || descuento.fechaHoraBajaDesc) return 0;
  const inicio = new Date(descuento.fechaInicioDesc);
  const fin = new Date(descuento.fechaFinDesc);
  if (fechaActual >= inicio && fechaActual <= fin) {
    return descuento.porcentajeDesc;
  }
  return 0;
}

/**
 * Calcula el precio neto unitario aplicando un porcentaje de descuento.
 */
export function calcularPrecioNetoConDescuento(precioLista: number, porcentajeDesc: number): number {
  if (porcentajeDesc <= 0) return Math.round(precioLista);
  return Math.round(precioLista * (1 - porcentajeDesc / 100));
}
