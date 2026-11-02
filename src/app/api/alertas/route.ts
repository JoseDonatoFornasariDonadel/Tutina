import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const config = await prisma.configuracionTienda.findFirst();
  const umbralGlobal = config?.umbralAlertaStockDefault ?? 3;
  const diasTolerancia = config?.diasToleranciaPendientePago ?? 5;
  const contarDesde =
    config?.alertaPagoContarDesde === 'CAMBIO_ESTADO' ? 'CAMBIO_ESTADO' : 'FECHA_PEDIDO';

  // Asegurar que exista el estado "Entregado y pendiente de pago"
  let estadoEntregadoPendiente = await prisma.estadoPedido.findFirst({
    where: {
      nombreEP: 'Entregado y pendiente de pago',
      fechaHoraBajaEP: null,
    },
  });

  if (!estadoEntregadoPendiente) {
    estadoEntregadoPendiente = await prisma.estadoPedido.create({
      data: {
        nombreEP: 'Entregado y pendiente de pago',
        colorBadge: 'amber',
        reservaStock: true,
        liberaStock: false,
        impactaEnReportesVenta: true,
      },
    });
  }

  const [alertasLog, variantesCriticas, pedidosEnPendientePago, estadosActivos] = await Promise.all([
    prisma.alertaWhatsAppLog.findMany({
      include: {
        variante: {
          include: {
            producto: { include: { marca: true, proveedorHabitual: true } },
            talle: true,
            color: true,
          },
        },
      },
      orderBy: { fechaDisparo: 'desc' },
      take: 50,
    }),
    prisma.varianteProducto.findMany({
      where: {
        fechaHoraBajaVar: null,
        stock: { lt: umbralGlobal },
      },
      include: {
        producto: {
          include: { marca: true, categoria: true, proveedorHabitual: true },
        },
        talle: true,
        color: true,
      },
      orderBy: { stock: 'asc' },
    }),
    prisma.pedido.findMany({
      where: {
        codEstadoActual: estadoEntregadoPendiente.codEP,
      },
      include: {
        cliente: true,
        estadoActual: true,
        historialEstados: {
          include: { estadoPedido: true },
          orderBy: { fechaInicioPE: 'desc' },
        },
        detallesPedido: {
          include: {
            variante: {
              include: {
                producto: { include: { marca: true } },
                talle: true,
                color: true,
              },
            },
          },
        },
      },
      orderBy: { fechaPedido: 'asc' },
    }),
    prisma.estadoPedido.findMany({
      where: { fechaHoraBajaEP: null },
    }),
  ]);

  const ahora = new Date();
  const msPorDia = 1000 * 60 * 60 * 24;

  // La alerta se reevalúa en cada consulta (no se guarda ningún flag), así que un pedido
  // viejo que recién pasa a "Entregado y pendiente de pago" se evalúa igual que el resto.
  const pedidosConAntiguedad = pedidosEnPendientePago.map((pedido) => {
    const fechaPedidoDate = new Date(pedido.fechaPedido);

    // Fecha en la que entró al estado actual: el registro de historial abierto más reciente
    // de ese estado. Si el pedido no tiene historial, se usa la fecha del pedido.
    const registrosDelEstado = pedido.historialEstados
      .filter((h) => h.codEP === pedido.codEstadoActual)
      .sort((a, b) => new Date(b.fechaInicioPE).getTime() - new Date(a.fechaInicioPE).getTime());
    const estadoVigente =
      registrosDelEstado.find((h) => h.fechaFinPE === null) || registrosDelEstado[0];
    const fechaInicioEstado = estadoVigente
      ? new Date(estadoVigente.fechaInicioPE)
      : fechaPedidoDate;

    const fechaReferencia = contarDesde === 'FECHA_PEDIDO' ? fechaPedidoDate : fechaInicioEstado;

    const diasEnEstado = Math.max(
      0,
      Math.floor((ahora.getTime() - fechaReferencia.getTime()) / msPorDia)
    );

    return {
      nroPedido: pedido.nroPedido,
      fechaPedido: pedido.fechaPedido,
      fechaInicioEstado: fechaInicioEstado.toISOString(),
      fechaReferencia: fechaReferencia.toISOString(),
      diasEnEstado,
      total: pedido.total,
      observaciones: pedido.observaciones,
      cliente: pedido.cliente,
      estadoActual: pedido.estadoActual,
      detallesPedido: pedido.detallesPedido,
    };
  });

  // Filtrar los que superan los días de tolerancia configurados
  const pedidosPendientesVencidos = pedidosConAntiguedad
    .filter((p) => p.diasEnEstado >= diasTolerancia)
    .sort((a, b) => b.diasEnEstado - a.diasEnEstado);

  const pedidosPendientesEnPlazo = pedidosConAntiguedad
    .filter((p) => p.diasEnEstado < diasTolerancia)
    .sort((a, b) => b.diasEnEstado - a.diasEnEstado);

  const estadoPagado = estadosActivos.find(
    (e) =>
      e.nombreEP.toLowerCase().includes('pagado') &&
      !e.nombreEP.toLowerCase().includes('pendiente')
  );

  return NextResponse.json({
    alertasLog,
    variantesCriticas,
    pedidosPendientesVencidos,
    pedidosPendientesEnPlazo,
    umbralDiasPendientePago: diasTolerancia,
    alertaPagoContarDesde: contarDesde,
    codEstadoPagado: estadoPagado?.codEP ?? null,
    umbralGlobal,
    telefonoDestino: config?.telefonoWhatsAppNotificaciones ?? '+5493516543210',
  });
}

export async function PATCH() {
  await prisma.alertaWhatsAppLog.updateMany({
    where: { leidaEnPanel: false },
    data: { leidaEnPanel: true },
  });
  return NextResponse.json({ ok: true });
}
