import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { registrarFacturaIngreso } from '@/lib/services/ingresos.service';
import { urlImagenPublica } from '@/lib/services/tienda.service';

export async function GET() {
  // Rendimiento: solo los campos que usa la pantalla. Antes se traían los comprobantes
  // (base64) de cada factura dos veces y la foto de la prenda repetida en cada variante.
  const [proveedores, facturasRaw, facturasConComprobante, variantesRaw] = await Promise.all([
    prisma.proveedor.findMany({
      where: { fechaHoraBajaProv: null },
      include: {
        facturas: {
          select: { idFactura: true },
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
      select: {
        idFactura: true,
        nroFactura: true,
        fechaFactura: true,
        fechaRegistroIngreso: true,
        ivaFactura: true,
        costoTotal: true,
        codProveedor: true,
        proveedor: { select: { codProveedor: true, nombreProveedor: true } },
        detallesIngreso: {
          select: {
            idDetalleIngreso: true,
            cantidadDI: true,
            precioIndividual: true,
            subtotalDI: true,
            codVariante: true,
            variante: {
              select: {
                sku: true,
                producto: { select: { codProducto: true, nombre: true } },
                talle: { select: { nombreTalle: true } },
                color: { select: { nombreColor: true } },
              },
            },
          },
        },
      },
      orderBy: { fechaFactura: 'desc' },
    }),
    prisma.factura.findMany({
      where: {
        fechaHoraBajaFact: null,
        OR: [{ comprobanteUrl: { not: null } }, { rutaFacturaPDF: { not: null } }],
      },
      select: { idFactura: true },
    }),
    prisma.varianteProducto.findMany({
      where: { fechaHoraBajaVar: null },
      select: {
        codVariante: true,
        sku: true,
        stock: true,
        imagenVariante: true,
        talle: { select: { codTalle: true, nombreTalle: true } },
        color: { select: { codColor: true, nombreColor: true, codigoHex: true } },
        producto: {
          select: {
            codProducto: true,
            nombre: true,
            imagen: true,
            precioCosto: true,
            porcentajeMarkup: true,
            precio: true,
            marca: { select: { codMarca: true, nombreMarca: true } },
            categoria: { select: { codCategoria: true, nombreCategoria: true } },
          },
        },
      },
      orderBy: [{ producto: { nombre: 'asc' } }, { talle: { ordenVisualizacion: 'asc' } }],
    }),
  ]);

  const idsConComprobante = new Set(facturasConComprobante.map((f) => f.idFactura));
  const facturas = facturasRaw.map((f) => ({
    ...f,
    tieneComprobante: idsConComprobante.has(f.idFactura),
  }));

  // Las fotos viajan como URL corta (se sirven aparte con caché), no como base64
  const variantes = variantesRaw.map((v) => ({
    ...v,
    imagenVariante: urlImagenPublica('variante', v.codVariante, v.imagenVariante),
    producto: {
      ...v.producto,
      imagen: urlImagenPublica('producto', v.producto.codProducto, v.producto.imagen) ?? '',
    },
  }));

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
    revalidatePath('/tienda');
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

    revalidatePath('/tienda');
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

    revalidatePath('/tienda');
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al dar de baja al proveedor';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
