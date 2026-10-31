import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const UMBRAL_DIAS_PENDIENTE_PAGO = 5;

export async function GET() {
  const config = await prisma.configuracionTienda.findFirst();
  const umbralGlobal = config?.umbralAlertaStockDefault ?? 3;

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

  const pedidosConAntiguedad = pedidosEnPendientePago.map((pedido) => {
    const estadoVigente =
      pedido.historialEstados.find(
        (h) => h.codEP === pedido.codEstadoActual && h.fechaFinPE === null
      ) ||
      pedido.historialEstados.find((h) => h.codEP === pedido.codEstadoActual) ||
      pedido.historialEstados[0];

    const fechaPedidoDate = new Date(pedido.fechaPedido);
    const fechaEstadoDate = estadoVigente
      ? new Date(estadoVigente.fechaInicioPE)
      : fechaPedidoDate;

    // Si fue creado directamente en este estado, tomamos la menor entre fechaPedido y fechaInicioPE
    const fechaInicioEstado =
      pedido.historialEstados.length <= 1 && fechaPedidoDate < fechaEstadoDate
        ? fechaPedidoDate
        : fechaEstadoDate;

    const diasEnEstado = Math.max(
      0,
      Math.floor((ahora.getTime() - fechaInicioEstado.getTime()) / msPorDia)
    );

    return {
      nroPedido: pedido.nroPedido,
      fechaPedido: pedido.fechaPedido,
      fechaInicioEstado: fechaInicioEstado.toISOString(),
      diasEnEstado,
      total: pedido.total,
      observaciones: pedido.observaciones,
      cliente: pedido.cliente,
      estadoActual: pedido.estadoActual,
      detallesPedido: pedido.detallesPedido,
    };
  });

  // Filtrar los que llevan 5 días o más en estado "Entregado y pendiente de pago"
  const pedidosPendientesVencidos = pedidosConAntiguedad
    .filter((p) => p.diasEnEstado >= UMBRAL_DIAS_PENDIENTE_PAGO)
    .sort((a, b) => b.diasEnEstado - a.diasEnEstado);

  const pedidosPendientesEnPlazo = pedidosConAntiguedad
    .filter((p) => p.diasEnEstado < UMBRAL_DIAS_PENDIENTE_PAGO)
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
    umbralDiasPendientePago: UMBRAL_DIAS_PENDIENTE_PAGO,
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
