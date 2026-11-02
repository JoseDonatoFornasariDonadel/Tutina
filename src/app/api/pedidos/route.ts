import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  cambiarEstadoPedido,
  registrarEntregaParcialPedido,
  registrarNuevoPedido,
} from '@/lib/services/pedidos.service';

export async function GET() {
  // Asegurar que exista el estado "Entregado y pendiente de pago" en la base de datos
  const existeEntregadoPendientePago = await prisma.estadoPedido.findFirst({
    where: {
      nombreEP: 'Entregado y pendiente de pago',
      fechaHoraBajaEP: null,
    },
  });

  if (!existeEntregadoPendientePago) {
    await prisma.estadoPedido.create({
      data: {
        nombreEP: 'Entregado y pendiente de pago',
        colorBadge: 'amber',
        reservaStock: true,
        liberaStock: false,
        impactaEnReportesVenta: true,
      },
    });
  }

  // Sincronizar pedidos preexistentes que aún tengan totalPagado=0 y totalAPagar=0 tras agregar las nuevas columnas
  const pedidosSinSincronizar = await prisma.pedido.findMany({
    where: {
      total: { gt: 0 },
      totalPagado: 0,
      totalAPagar: 0,
    },
    include: { estadoActual: true },
  });

  for (const p of pedidosSinSincronizar) {
    const nombreEstado = p.estadoActual.nombreEP.toLowerCase();
    const esPendiente =
      nombreEstado.includes('pendiente') || nombreEstado.includes('seña');
    const esDevuelto = p.estadoActual.liberaStock;

    await prisma.pedido.update({
      where: { nroPedido: p.nroPedido },
      data: {
        totalPagado: esPendiente || esDevuelto ? 0 : p.total,
        totalAPagar: esPendiente ? p.total : 0,
      },
    });
  }

  const [pedidos, estados, formasPago, ultimoPedido] = await Promise.all([
    prisma.pedido.findMany({
      include: {
        cliente: true,
        estadoActual: true,
        historialEstados: {
          include: { estadoPedido: true },
          orderBy: { fechaInicioPE: 'desc' },
        },
        formasPago: {
          include: { formaPago: true },
          orderBy: { fechaPFP: 'asc' },
        },
        detallesPedido: {
          include: {
            variante: {
              include: {
                producto: {
                  include: { marca: true, categoria: true },
                },
                talle: true,
                color: true,
              },
            },
          },
        },
      },
      orderBy: { nroPedido: 'desc' },
    }),
    prisma.estadoPedido.findMany({ where: { fechaHoraBajaEP: null } }),
    prisma.formaPago.findMany({ where: { fechaHoraBajaFP: null } }),
    prisma.pedido.findFirst({ orderBy: { nroPedido: 'desc' } }),
  ]);

  return NextResponse.json({
    pedidos,
    estados,
    formasPago,
    proximoNroPedido: (ultimoPedido?.nroPedido ?? 0) + 1,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const resultado = await registrarNuevoPedido(body);
    revalidatePath('/tienda');
    return NextResponse.json(resultado);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al registrar el pedido';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    // Si es una entrega parcial de pago del pedido
    if (body.tipoOperacion === 'ENTREGA_PARCIAL') {
      const actualizado = await registrarEntregaParcialPedido({
        nroPedido: Number(body.nroPedido),
        montoEntrega: Number(body.montoEntrega),
        codFP: body.codFP ? Number(body.codFP) : undefined,
        comprobanteReferencia: body.comprobanteReferencia,
      });
      revalidatePath('/tienda');
      return NextResponse.json(actualizado);
    }

    const { nroPedido, nuevoCodEP, motivoCambio } = body;
    const actualizado = await cambiarEstadoPedido(
      Number(nroPedido),
      Number(nuevoCodEP),
      motivoCambio
    );
    revalidatePath('/tienda');
    return NextResponse.json(actualizado);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al actualizar el pedido';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
