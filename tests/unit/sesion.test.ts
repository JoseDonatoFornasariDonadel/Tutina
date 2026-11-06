import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  DURACION_SESION_MS,
  compararSeguro,
  generarTokenSesionAdmin,
  verificarTokenSesionAdmin,
} from '@/lib/auth';

describe('Sesión del panel', () => {
  beforeEach(() => {
    process.env.TUTINA_SESSION_SECRET = 'secreto-de-prueba-secreto-de-prueba-123';
    process.env.TUTINA_ADMIN_PASSWORD = 'clave-original';
  });

  it('acepta una sesión recién creada', async () => {
    const token = await generarTokenSesionAdmin('Admin');
    assert.equal(await verificarTokenSesionAdmin(token), true);
  });

  it('rechaza sesiones vacías, mal formadas o del formato anterior', async () => {
    assert.equal(await verificarTokenSesionAdmin(undefined), false);
    assert.equal(await verificarTokenSesionAdmin(''), false);
    assert.equal(await verificarTokenSesionAdmin('admin.123.abc'), false);
    assert.equal(await verificarTokenSesionAdmin('a.b.c.d.e'), false);
  });

  it('rechaza una sesión modificada (otro usuario o más días)', async () => {
    const token = await generarTokenSesionAdmin('admin');
    const [usuario, exp, huella, firma] = token.split('.');
    assert.equal(await verificarTokenSesionAdmin(`otra.${exp}.${huella}.${firma}`), false);
    const masTiempo = String(Number(exp) + DURACION_SESION_MS);
    assert.equal(await verificarTokenSesionAdmin(`${usuario}.${masTiempo}.${huella}.${firma}`), false);
  });

  it('rechaza una sesión vencida', async () => {
    const hace8Dias = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const token = await generarTokenSesionAdmin('admin', hace8Dias);
    assert.equal(await verificarTokenSesionAdmin(token), false);
  });

  it('cambiar la contraseña cierra las sesiones abiertas', async () => {
    const token = await generarTokenSesionAdmin('admin');
    process.env.TUTINA_ADMIN_PASSWORD = 'clave-nueva';
    assert.equal(await verificarTokenSesionAdmin(token), false);
    // Con la clave nueva, una sesión nueva sí vale
    assert.equal(await verificarTokenSesionAdmin(await generarTokenSesionAdmin('admin')), true);
  });

  it('cambiar el secreto de sesión también las cierra', async () => {
    const token = await generarTokenSesionAdmin('admin');
    process.env.TUTINA_SESSION_SECRET = 'otro-secreto-otro-secreto-otro-secreto-1';
    assert.equal(await verificarTokenSesionAdmin(token), false);
  });

  it('sin secreto configurado no valida ninguna sesión', async () => {
    const token = await generarTokenSesionAdmin('admin');
    delete process.env.TUTINA_SESSION_SECRET;
    assert.equal(await verificarTokenSesionAdmin(token), false);
  });

  it('compararSeguro compara textos completos', () => {
    assert.equal(compararSeguro('abc', 'abc'), true);
    assert.equal(compararSeguro('abc', 'abd'), false);
    assert.equal(compararSeguro('abc', 'abcd'), false);
  });
});
