import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_FALLOS,
  VENTANA_MS,
  claveDeIp,
  evaluarBloqueo,
  obtenerIp,
  textoEspera,
} from '@/lib/limiteAcceso';

const ahora = Date.parse('2026-11-06T12:00:00Z');
const haceMin = (min: number) => new Date(ahora - min * 60 * 1000);

describe('Límite de intentos de inicio de sesión', () => {
  it(`con menos de ${MAX_FALLOS} fallos no bloquea`, () => {
    const fallos = Array.from({ length: MAX_FALLOS - 1 }, (_, i) => haceMin(i));
    assert.deepEqual(evaluarBloqueo(fallos, ahora), { bloqueado: false, segundosRestantes: 0 });
  });

  it(`con ${MAX_FALLOS} fallos recientes bloquea hasta que vence el más viejo`, () => {
    const fallos = [haceMin(1), haceMin(2), haceMin(3), haceMin(4), haceMin(5)];
    const r = evaluarBloqueo(fallos, ahora);
    assert.equal(r.bloqueado, true);
    // El quinto fallo fue hace 5 min: faltan 10 de los 15
    assert.equal(r.segundosRestantes, 10 * 60);
  });

  it('los fallos fuera de la ventana no cuentan', () => {
    const fuera = new Date(ahora - VENTANA_MS - 1000);
    const fallos = [haceMin(1), haceMin(2), haceMin(3), haceMin(4), fuera, fuera];
    assert.equal(evaluarBloqueo(fallos, ahora).bloqueado, false);
  });

  it('toma la IP real del primer valor de x-forwarded-for', () => {
    assert.equal(obtenerIp(new Headers({ 'x-forwarded-for': '200.1.2.3, 10.0.0.1' })), '200.1.2.3');
    assert.equal(obtenerIp(new Headers({ 'x-real-ip': '181.4.5.6' })), '181.4.5.6');
    assert.equal(obtenerIp(new Headers()), 'desconocida');
  });

  it('no guarda la IP: usa una huella fija por IP', () => {
    const a = claveDeIp('200.1.2.3');
    assert.equal(a, claveDeIp('200.1.2.3'));
    assert.notEqual(a, claveDeIp('200.1.2.4'));
    assert.ok(!a.includes('200.1.2.3'));
  });

  it('muestra la espera en minutos', () => {
    assert.equal(textoEspera(30), 'un minuto');
    assert.equal(textoEspera(600), '10 minutos');
  });
});
