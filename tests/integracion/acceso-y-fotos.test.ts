import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';
import { MAX_FALLOS, consultarBloqueo, registrarIntento } from '@/lib/limiteAcceso';
import {
  calcularHuellaFoto,
  migrarFotosAnteriores,
  sincronizarPortadaColor,
} from '@/lib/services/fotos.service';
import { crearEscenario, verificarBaseDePrueba } from './ayuda';

before(() => verificarBaseDePrueba());
after(() => prisma.$disconnect());

describe('Límite de intentos (con la base)', () => {
  it(`bloquea después de ${MAX_FALLOS} fallos y un acceso correcto lo limpia`, async () => {
    const clave = `prueba-${Date.now()}`;
    for (let i = 0; i < MAX_FALLOS - 1; i++) await registrarIntento(clave, false);
    assert.equal((await consultarBloqueo(clave)).bloqueado, false);
    await registrarIntento(clave, false);
    const bloqueo = await consultarBloqueo(clave);
    assert.equal(bloqueo.bloqueado, true);
    assert.ok(bloqueo.segundosRestantes > 0);
    // Otra conexión no queda bloqueada
    assert.equal((await consultarBloqueo(`${clave}-otra`)).bloqueado, false);
    await registrarIntento(clave, true);
    assert.equal((await consultarBloqueo(clave)).bloqueado, false);
  });
});

describe('Fotos por color', () => {
  const foto = (n: number) => `data:image/jpeg;base64,${Buffer.from(`foto-${n}`).toString('base64')}`;

  it('la foto única de antes pasa a la galería una sola vez', async () => {
    const e = await crearEscenario();
    await prisma.varianteProducto.update({
      where: { codVariante: e.variante.codVariante },
      data: { imagenVariante: foto(1) },
    });
    assert.equal(await migrarFotosAnteriores(e.producto.codProducto), 1);
    assert.equal(await migrarFotosAnteriores(e.producto.codProducto), 0);
  });

  it('la portada se copia a los talles y a la foto principal', async () => {
    const e = await crearEscenario();
    await prisma.fotoProductoColor.createMany({
      data: [2, 3].map((n, orden) => ({
        codProducto: e.producto.codProducto,
        codColor: e.color.codColor,
        imagen: foto(n),
        huella: calcularHuellaFoto(foto(n)),
        orden,
      })),
    });
    await sincronizarPortadaColor(e.producto.codProducto, e.color.codColor);
    const v = await prisma.varianteProducto.findUniqueOrThrow({
      where: { codVariante: e.variante.codVariante },
    });
    const p = await prisma.producto.findUniqueOrThrow({
      where: { codProducto: e.producto.codProducto },
    });
    assert.equal(v.imagenVariante, foto(2));
    assert.equal(p.imagen, foto(2));
  });
});
