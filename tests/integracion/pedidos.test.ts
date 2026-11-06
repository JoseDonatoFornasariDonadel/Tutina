import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';
import { cambiarEstadoPedido, registrarNuevoPedido } from '@/lib/services/pedidos.service';
import { registrarFacturaIngreso } from '@/lib/services/ingresos.service';
import { crearEscenario, stockDe, verificarBaseDePrueba } from './ayuda';

before(() => verificarBaseDePrueba());
after(() => prisma.$disconnect());

describe('Pedidos y stock', () => {
  it('un pedido descuenta stock y calcula el total con el precio de la base', async () => {
    const e = await crearEscenario({ stock: 5, precio: 10000 });
    const { pedido } = await registrarNuevoPedido({
      codCliente: e.cliente.codCliente,
      codFP: e.formaPago.codFP,
      codEstadoActual: e.estadoPagado.codEP,
      items: [{ codVariante: e.variante.codVariante, cantidad: 2 }],
    });
    assert.equal(await stockDe(e.variante.codVariante), 3);
    assert.equal(pedido.total, 20000);
    assert.equal(pedido.detallesPedido[0].precioUnitarioCostoHistorico, 5000);
  });

  it('sin stock suficiente no se crea nada', async () => {
    const e = await crearEscenario({ stock: 1 });
    await assert.rejects(
      registrarNuevoPedido({
        codCliente: e.cliente.codCliente,
        codFP: e.formaPago.codFP,
        codEstadoActual: e.estadoPagado.codEP,
        items: [{ codVariante: e.variante.codVariante, cantidad: 2 }],
      }),
      /Stock insuficiente/
    );
    assert.equal(await stockDe(e.variante.codVariante), 1);
    assert.equal(await prisma.pedido.count({ where: { codCliente: e.cliente.codCliente } }), 0);
  });

  it('una cantidad negativa se rechaza (antes sumaba stock)', async () => {
    const e = await crearEscenario({ stock: 2 });
    await assert.rejects(
      registrarNuevoPedido({
        codCliente: e.cliente.codCliente,
        codFP: e.formaPago.codFP,
        codEstadoActual: e.estadoPagado.codEP,
        items: [{ codVariante: e.variante.codVariante, cantidad: -3 }],
      }),
      /cantidad entera mayor a 0/
    );
    assert.equal(await stockDe(e.variante.codVariante), 2);
  });

  it('dos pedidos simultáneos por la última unidad: solo uno se registra', async () => {
    const e = await crearEscenario({ stock: 1 });
    const pedir = () =>
      registrarNuevoPedido({
        codCliente: e.cliente.codCliente,
        codFP: e.formaPago.codFP,
        codEstadoActual: e.estadoPagado.codEP,
        items: [{ codVariante: e.variante.codVariante, cantidad: 1 }],
      });
    const resultados = await Promise.allSettled([pedir(), pedir(), pedir()]);
    assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(await stockDe(e.variante.codVariante), 0);
  });

  it('cancelar devuelve el stock y reactivar lo vuelve a descontar', async () => {
    const e = await crearEscenario({ stock: 3 });
    const { pedido } = await registrarNuevoPedido({
      codCliente: e.cliente.codCliente,
      codFP: e.formaPago.codFP,
      codEstadoActual: e.estadoPagado.codEP,
      items: [{ codVariante: e.variante.codVariante, cantidad: 2 }],
    });
    await cambiarEstadoPedido(pedido.nroPedido, e.estadoCancelado.codEP);
    assert.equal(await stockDe(e.variante.codVariante), 3);
    await cambiarEstadoPedido(pedido.nroPedido, e.estadoPagado.codEP);
    assert.equal(await stockDe(e.variante.codVariante), 1);
  });

  it('no se puede reactivar un pedido si su stock ya se vendió', async () => {
    const e = await crearEscenario({ stock: 2 });
    const base = {
      codCliente: e.cliente.codCliente,
      codFP: e.formaPago.codFP,
      codEstadoActual: e.estadoPagado.codEP,
    };
    const { pedido } = await registrarNuevoPedido({
      ...base,
      items: [{ codVariante: e.variante.codVariante, cantidad: 2 }],
    });
    await cambiarEstadoPedido(pedido.nroPedido, e.estadoCancelado.codEP);
    // Mientras estaba cancelado, otro pedido se llevó las 2 unidades
    await registrarNuevoPedido({ ...base, items: [{ codVariante: e.variante.codVariante, cantidad: 2 }] });
    await assert.rejects(
      cambiarEstadoPedido(pedido.nroPedido, e.estadoPagado.codEP),
      /No hay stock para reactivar/
    );
    assert.equal(await stockDe(e.variante.codVariante), 0);
    const sigue = await prisma.pedido.findUniqueOrThrow({ where: { nroPedido: pedido.nroPedido } });
    assert.equal(sigue.codEstadoActual, e.estadoCancelado.codEP);
  });
});

describe('Facturas de proveedor', () => {
  it('suman stock y actualizan el costo de la prenda', async () => {
    const e = await crearEscenario({ stock: 1, costo: 5000 });
    const proveedor = await prisma.proveedor.create({
      data: { nombreProveedor: 'Proveedor prueba', numeroProveedor: '1' },
    });
    await registrarFacturaIngreso({
      codProveedor: proveedor.codProveedor,
      nroFactura: 'A-0001',
      detalles: [{ codVariante: e.variante.codVariante, cantidadDI: 4, precioIndividual: 6000 }],
    });
    assert.equal(await stockDe(e.variante.codVariante), 5);
    const prod = await prisma.producto.findUniqueOrThrow({
      where: { codProducto: e.producto.codProducto },
    });
    assert.equal(prod.precioCosto, 6000);
  });

  it('rechazan cantidades negativas o costos inválidos', async () => {
    const e = await crearEscenario({ stock: 4 });
    const proveedor = await prisma.proveedor.create({
      data: { nombreProveedor: 'Proveedor prueba', numeroProveedor: '1' },
    });
    for (const detalle of [
      { cantidadDI: -2, precioIndividual: 1000 },
      { cantidadDI: 2, precioIndividual: -1 },
    ]) {
      await assert.rejects(
        registrarFacturaIngreso({
          codProveedor: proveedor.codProveedor,
          nroFactura: 'A-0002',
          detalles: [{ codVariante: e.variante.codVariante, ...detalle }],
        })
      );
    }
    assert.equal(await stockDe(e.variante.codVariante), 4);
  });
});
