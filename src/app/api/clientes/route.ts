import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();

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
    const esPendiente = nombreEstado.includes('pendiente') || nombreEstado.includes('seña');
    const esDevuelto = p.estadoActual.liberaStock;

    await prisma.pedido.update({
      where: { nroPedido: p.nroPedido },
      data: {
        totalPagado: esPendiente || esDevuelto ? 0 : p.total,
        totalAPagar: esPendiente ? p.total : 0,
      },
    });
  }

  const clientes = await prisma.cliente.findMany({
    where: {
      fechaHoraBajaCliente: null,
      ...(q
        ? {
            OR: [
              { nombreCliente: { contains: q } },
              { apellidoCliente: { contains: q } },
              { telefonoCliente: { contains: q } },
              { dniCuit: { contains: q } },
              { emailCliente: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      pedidos: {
        include: {
          estadoActual: true,
          formasPago: {
            include: { formaPago: true },
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
        orderBy: { fechaPedido: 'desc' },
      },
    },
    orderBy: [{ apellidoCliente: 'asc' }, { nombreCliente: 'asc' }],
  });

  return NextResponse.json(clientes);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nombreCliente, apellidoCliente, telefonoCliente, emailCliente, dniCuit } = body;

    if (!nombreCliente || !apellidoCliente || !telefonoCliente) {
      return NextResponse.json(
        { error: 'Nombre, apellido y teléfono del cliente son obligatorios.' },
        { status: 400 }
      );
    }

    const nuevoCliente = await prisma.cliente.create({
      data: {
        nombreCliente: String(nombreCliente).trim(),
        apellidoCliente: String(apellidoCliente).trim(),
        telefonoCliente: String(telefonoCliente).trim(),
        emailCliente: emailCliente ? String(emailCliente).trim() : null,
        dniCuit: dniCuit ? String(dniCuit).trim() : null,
      },
      include: {
        pedidos: {
          include: {
            estadoActual: true,
            formasPago: { include: { formaPago: true } },
            detallesPedido: {
              include: {
                variante: {
                  include: {
                    producto: { include: { marca: true, categoria: true } },
                    talle: true,
                    color: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(nuevoCliente);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al registrar cliente';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { codCliente, nombreCliente, apellidoCliente, telefonoCliente, emailCliente, dniCuit } =
      body;

    const actualizado = await prisma.cliente.update({
      where: { codCliente: Number(codCliente) },
      data: {
        nombreCliente: String(nombreCliente).trim(),
        apellidoCliente: String(apellidoCliente).trim(),
        telefonoCliente: String(telefonoCliente).trim(),
        emailCliente: emailCliente ? String(emailCliente).trim() : null,
        dniCuit: dniCuit ? String(dniCuit).trim() : null,
      },
    });

    return NextResponse.json(actualizado);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al actualizar cliente';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
