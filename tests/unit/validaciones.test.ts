import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validarItemsPedido } from '@/lib/services/pedidos.service';
import { calcularHuellaFoto, urlFoto, validarFotoSubida } from '@/lib/services/fotos.service';

describe('Ítems de un pedido', () => {
  it('acepta cantidades enteras positivas', () => {
    assert.deepEqual(validarItemsPedido([{ codVariante: 3, cantidad: 2 }]), [
      { codVariante: 3, cantidad: 2 },
    ]);
  });

  it('rechaza un pedido vacío', () => {
    assert.throws(() => validarItemsPedido([]), /al menos un producto/);
    assert.throws(() => validarItemsPedido(undefined), /al menos un producto/);
  });

  it('rechaza cantidades 0, negativas o con decimales (sumarían stock o romperían totales)', () => {
    for (const cantidad of [0, -1, 1.5, Number.NaN]) {
      assert.throws(
        () => validarItemsPedido([{ codVariante: 3, cantidad }]),
        /cantidad entera mayor a 0/
      );
    }
  });

  it('rechaza variantes inválidas', () => {
    assert.throws(() => validarItemsPedido([{ codVariante: 0, cantidad: 1 }]), /no es válido/);
  });
});

describe('Fotos subidas desde el panel', () => {
  const jpg = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

  it('acepta imágenes en base64 y links https', () => {
    assert.equal(validarFotoSubida(jpg), null);
    assert.equal(validarFotoSubida('https://ejemplo.com/foto.webp'), null);
  });

  it('rechaza lo que no es una imagen', () => {
    assert.match(String(validarFotoSubida('')), /Falta la foto/);
    assert.match(String(validarFotoSubida('javascript:alert(1)')), /no es una imagen/);
    assert.match(String(validarFotoSubida('data:text/html;base64,PGgxPg==')), /no es una imagen/);
    assert.match(String(validarFotoSubida('http://sin-https.com/a.jpg')), /no es una imagen/);
  });

  it('rechaza fotos demasiado pesadas', () => {
    assert.match(String(validarFotoSubida(jpg + 'A'.repeat(4_000_001))), /demasiado pesada/);
  });

  it('la URL cambia cuando cambia la foto (caché sin vencimiento)', () => {
    const h1 = calcularHuellaFoto(jpg);
    assert.equal(h1, calcularHuellaFoto(jpg));
    assert.notEqual(h1, calcularHuellaFoto(jpg + 'x'));
    assert.equal(urlFoto({ idFoto: 7, huella: h1 }), `/api/imagenes/foto/7/${h1}`);
    assert.ok(calcularHuellaFoto('data:image/svg+xml;base64,PHN2Zz4=').endsWith('.svg'));
    assert.equal(urlFoto({ idFoto: 7, huella: h1, externa: 'https://x.com/a.jpg' }), 'https://x.com/a.jpg');
  });
});
