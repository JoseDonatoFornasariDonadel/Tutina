import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularCoeficienteReventa,
  calcularMarkupReverso,
  calcularPrecioNetoConDescuento,
  calcularPrecioSugerido,
  obtenerPorcentajeDescuentoVigente,
} from '@/lib/services/pricing.service';

describe('Precio sugerido por markup', () => {
  it('aplica el porcentaje sobre el costo y redondea al peso', () => {
    assert.equal(calcularPrecioSugerido(12000, 125), 27000);
    assert.equal(calcularPrecioSugerido(14500, 130), 33350);
    assert.equal(calcularPrecioSugerido(999, 33.3), 1332);
  });

  it('con costo 0 o negativo devuelve 0 (no inventa precios)', () => {
    assert.equal(calcularPrecioSugerido(0, 120), 0);
    assert.equal(calcularPrecioSugerido(-500, 120), 0);
  });
});

describe('Markup reverso (precio redondeado a mano)', () => {
  it('recupera el markup a partir del precio final', () => {
    assert.equal(calcularMarkupReverso(12000, 27000), 125);
    assert.equal(calcularMarkupReverso(14500, 33350), 130);
  });

  it('ida y vuelta: costo + markup -> precio -> markup da el mismo valor', () => {
    for (const [costo, markup] of [
      [8000, 100],
      [15990, 87.5],
      [23450, 140],
    ]) {
      const precio = calcularPrecioSugerido(costo, markup);
      assert.ok(Math.abs(calcularMarkupReverso(costo, precio) - markup) < 0.05);
    }
  });

  it('con costo 0 devuelve 0 en lugar de infinito', () => {
    assert.equal(calcularMarkupReverso(0, 5000), 0);
  });
});

describe('Coeficiente de reventa', () => {
  it('120% de markup es 2,2x', () => {
    assert.equal(calcularCoeficienteReventa(120), 2.2);
    assert.equal(calcularCoeficienteReventa(0), 1);
  });
});

describe('Descuentos', () => {
  const promo = {
    porcentajeDesc: 15,
    fechaInicioDesc: '2026-11-01T00:00:00Z',
    fechaFinDesc: '2026-11-30T23:59:59Z',
  };

  it('aplica el porcentaje solo dentro de las fechas de la promo', () => {
    assert.equal(obtenerPorcentajeDescuentoVigente(promo, new Date('2026-11-15T12:00:00Z')), 15);
    assert.equal(obtenerPorcentajeDescuentoVigente(promo, new Date('2026-10-31T12:00:00Z')), 0);
    assert.equal(obtenerPorcentajeDescuentoVigente(promo, new Date('2026-12-01T12:00:00Z')), 0);
  });

  it('un descuento dado de baja no aplica', () => {
    assert.equal(
      obtenerPorcentajeDescuentoVigente(
        { ...promo, fechaHoraBajaDesc: '2026-11-10T00:00:00Z' },
        new Date('2026-11-15T12:00:00Z')
      ),
      0
    );
    assert.equal(obtenerPorcentajeDescuentoVigente(null), 0);
  });

  it('calcula el precio neto redondeado', () => {
    assert.equal(calcularPrecioNetoConDescuento(33350, 10), 30015);
    assert.equal(calcularPrecioNetoConDescuento(27000, 0), 27000);
    assert.equal(calcularPrecioNetoConDescuento(1999.6, 0), 2000);
  });
});
