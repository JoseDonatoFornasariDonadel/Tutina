import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { registrarFacturaIngreso } from '@/lib/services/ingresos.service';

export async function GET() {
  const [proveedores, facturas, variantes] = await Promise.all([
    prisma.proveedor.findMany({
      where: { fechaHoraBajaProv: null },
      include: {
        facturas: {
          orderBy: { fechaFactura: 'desc' },
        },
        productosHabituales: {
          where: { fechaHoraBajaProd: null },
          select: { codProducto: true, nombre: true },
        },
      },
      orderBy: { nombreProveedor: 'asc' },
    }),
    prisma.factura.findMany({
      where: { fechaHoraBajaFact: null },
      include: {
        proveedor: true,
        detallesIngreso: {
          include: {
            variante: {
              include: {
                producto: true,
                talle: true,
                color: true,
              },
            },
          },
        },
      },
      orderBy: { fechaFactura: 'desc' },
    }),
    prisma.varianteProducto.findMany({
      where: { fechaHoraBajaVar: null },
      include: {
        producto: {
          include: { marca: true, categoria: true },
        },
        talle: true,
        color: true,
      },
      orderBy: [{ producto: { nombre: 'asc' } }, { talle: { ordenVisualizacion: 'asc' } }],
    }),
  ]);

  return NextResponse.json({ proveedores, facturas, variantes });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.tipo === 'PROVEEDOR') {
      if (!body.nombreProveedor || !body.numeroProveedor) {
        return NextResponse.json(
          { error: 'El nombre y el número de teléfono del proveedor son obligatorios.' },
          { status: 400 }
        );
      }

      const nuevoProv = await prisma.proveedor.create({
        data: {
          nombreProveedor: String(body.nombreProveedor).trim(),
          numeroProveedor: String(body.numeroProveedor).trim(),
          correoProveedor: body.correoProveedor ? String(body.correoProveedor).trim() : null,
          webProveedor: body.webProveedor ? String(body.webProveedor).trim() : null,
        },
      });
      return NextResponse.json(nuevoProv);
    }

    const resultado = await registrarFacturaIngreso(body);
    return NextResponse.json(resultado);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al registrar operación de proveedor';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { codProveedor, nombreProveedor, numeroProveedor, correoProveedor, webProveedor } = body;

    const actualizado = await prisma.proveedor.update({
      where: { codProveedor: Number(codProveedor) },
      data: {
        nombreProveedor: String(nombreProveedor).trim(),
        numeroProveedor: String(numeroProveedor).trim(),
        correoProveedor: correoProveedor ? String(correoProveedor).trim() : null,
        webProveedor: webProveedor ? String(webProveedor).trim() : null,
      },
    });

    return NextResponse.json(actualizado);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al actualizar proveedor';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const codProveedor = Number(searchParams.get('codProveedor'));
    if (!codProveedor) {
      return NextResponse.json({ error: 'Código de proveedor inválido' }, { status: 400 });
    }

    await prisma.proveedor.update({
      where: { codProveedor },
      data: { fechaHoraBajaProv: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al dar de baja al proveedor';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
