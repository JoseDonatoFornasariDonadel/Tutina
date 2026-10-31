import { prisma } from '../src/lib/prisma';

async function main() {
  // 1. Asegurar que exista el estado "Entregado y pendiente de pago"
  let estadoPendiente = await prisma.estadoPedido.findFirst({
    where: {
      nombreEP: 'Entregado y pendiente de pago',
      fechaHoraBajaEP: null,
    },
  });

  if (!estadoPendiente) {
    estadoPendiente = await prisma.estadoPedido.create({
      data: {
        nombreEP: 'Entregado y pendiente de pago',
        colorBadge: 'amber',
        reservaStock: true,
        liberaStock: false,
        impactaEnReportesVenta: true,
      },
    });
  }

  // 2. Obtener clientes, forma de pago y variantes existentes
  const clientes = await prisma.cliente.findMany({
    where: { fechaHoraBajaCliente: null },
    take: 3,
  });

  if (clientes.length === 0) {
    throw new Error('No hay clientes en la base de datos.');
  }

  // Si hay menos de 3 clientes, creamos clientes adicionales para que las alertas luzcan bien variadas
  while (clientes.length < 3) {
    const nuevo = await prisma.cliente.create({
      data: {
        nombreCliente: clientes.length === 1 ? 'Camila' : 'Julieta',
        apellidoCliente: clientes.length === 1 ? 'Sánchez' : 'Navarro',
        telefonoCliente: clientes.length === 1 ? '+5493514455667' : '+5493517788990',
        emailCliente:
          clientes.length === 1 ? 'camila.sanchez@email.com' : 'julieta.navarro@email.com',
      },
    });
    clientes.push(nuevo);
  }

  const formaPago = await prisma.formaPago.findFirstOrThrow({
    where: { fechaHoraBajaFP: null },
  });

  const variantes = await prisma.varianteProducto.findMany({
    where: { fechaHoraBajaVar: null },
    include: { producto: true },
    take: 6,
  });

  if (variantes.length === 0) {
    throw new Error('No hay variantes de producto en la base de datos.');
  }

  const ahora = new Date();
  const msPorDia = 1000 * 60 * 60 * 24;

  // Fechas para probar:
  // - Pedido 1: Hace 9 días (Dispara alerta >= 5 días)
  // - Pedido 2: Hace 5 días (Dispara alerta >= 5 días exactamente en el límite)
  // - Pedido 3: Hace 2 días (Queda en plazo < 5 días para comparar)
  const casosPrueba = [
    {
      diasAtras: 9,
      cliente: clientes[0],
      observacion: 'Se llevó las prendas a prueba y quedó en transferir en la semana.',
      items: [
        { variante: variantes[0], cantidad: 1 },
        { variante: variantes[1] || variantes[0], cantidad: 1 },
      ],
    },
    {
      diasAtras: 5,
      cliente: clientes[1] || clientes[0],
      observacion: 'Entregado en el local, pendiente de pago por transferencia.',
      items: [{ variante: variantes[2] || variantes[0], cantidad: 2 }],
    },
    {
      diasAtras: 2,
      cliente: clientes[2] || clientes[0],
      observacion: 'Entregado hace 2 días, todavía dentro del plazo menor a 5 días.',
      items: [{ variante: variantes[3] || variantes[0], cantidad: 1 }],
    },
  ];

  for (const caso of casosPrueba) {
    const fecha = new Date(ahora.getTime() - caso.diasAtras * msPorDia);

    // Verificar si ya creamos un pedido de prueba con esta misma observación para no duplicar de más
    const existente = await prisma.pedido.findFirst({
      where: { observaciones: caso.observacion },
    });

    if (existente) {
      // Aseguramos que siga en estado "Entregado y pendiente de pago" y con la fecha correspondiente
      await prisma.pedido.update({
        where: { nroPedido: existente.nroPedido },
        data: {
          fechaPedido: fecha,
          codEstadoActual: estadoPendiente.codEP,
        },
      });
      await prisma.pedidoEstado.updateMany({
        where: { nroPedido: existente.nroPedido },
        data: {
          codEP: estadoPendiente.codEP,
          fechaInicioPE: fecha,
          fechaFinPE: null,
        },
      });
      console.log(
        `🔄 Pedido #${existente.nroPedido} actualizado (${caso.diasAtras} días en estado "Entregado y pendiente de pago").`
      );
      continue;
    }

    const detalles = caso.items.map((it) => {
      const precioUnit = it.variante.producto.precio;
      const costoUnit = it.variante.producto.precioCosto;
      const sub = precioUnit * it.cantidad;
      return {
        codVariante: it.variante.codVariante,
        Cantidad: it.cantidad,
        precioUnitarioVenta: precioUnit,
        porcentajeDescuentoAplicado: 0,
        precioUnitarioNeto: precioUnit,
        precioUnitarioCostoHistorico: costoUnit,
        subtotal: sub,
      };
    });

    const totalPedido = detalles.reduce((acc, d) => acc + d.subtotal, 0);

    const nuevoPedido = await prisma.pedido.create({
      data: {
        fechaPedido: fecha,
        canalVenta: 'LOCAL_MANUAL',
        subtotalBruto: totalPedido,
        montoDescuentosTotal: 0,
        total: totalPedido,
        observaciones: caso.observacion,
        codCliente: caso.cliente.codCliente,
        codEstadoActual: estadoPendiente.codEP,
        detallesPedido: {
          create: detalles,
        },
        historialEstados: {
          create: [
            {
              codEP: estadoPendiente.codEP,
              fechaInicioPE: fecha,
              motivoCambio: 'Entrega con pago pendiente (Datos de prueba)',
            },
          ],
        },
        formasPago: {
          create: [
            {
              codFP: formaPago.codFP,
              montoPFP: totalPedido,
              fechaPFP: fecha,
              porcentajeComisionAplicado: formaPago.porcentajeComisionActual,
              montoComisionCalculado: Math.round(
                totalPedido * (formaPago.porcentajeComisionActual / 100)
              ),
            },
          ],
        },
      },
    });

    console.log(
      `✅ Creado Pedido #${nuevoPedido.nroPedido} para ${caso.cliente.nombreCliente} ${caso.cliente.apellidoCliente} -> ${caso.diasAtras} días en "Entregado y pendiente de pago" ($${totalPedido})`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
