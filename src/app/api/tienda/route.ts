import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  calcularPrecioNetoConDescuento,
  obtenerPorcentajeDescuentoVigente,
} from '@/lib/services/pricing.service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.max(1, Number(searchParams.get('limit') || 12));
  const q = (searchParams.get('q') || '').trim();
  const codCategoria = searchParams.get('codCategoria');
  const codMarca = searchParams.get('codMarca');
  const codTemporada = searchParams.get('codTemporada');
  const orden = searchParams.get('orden') || 'MAS_RECIENTES';

  const whereClause: Prisma.ProductoWhereInput = {
    fechaHoraBajaProd: null,
    ...(q
      ? {
          OR: [
            { nombre: { contains: q } },
            { descripcion: { contains: q } },
            { marca: { nombreMarca: { contains: q } } },
            { categoria: { nombreCategoria: { contains: q } } },
          ],
        }
      : {}),
    ...(codCategoria && codCategoria !== 'TODAS'
      ? { codCategoria: Number(codCategoria) }
      : {}),
    ...(codMarca && codMarca !== 'TODAS' ? { codMarca: Number(codMarca) } : {}),
    ...(codTemporada && codTemporada !== 'TODAS'
      ? {
          productosTemporada: {
            some: {
              fechaHoraBajaPT: null,
              codTemporada: Number(codTemporada),
            },
          },
        }
      : {}),
  };

  let orderByClause: Prisma.ProductoOrderByWithRelationInput = { codProducto: 'desc' };
  if (orden === 'MAS_ANTIGUAS') {
    orderByClause = { codProducto: 'asc' };
  } else if (orden === 'PRECIO_MENOR') {
    orderByClause = { precio: 'asc' };
  } else if (orden === 'PRECIO_MAYOR') {
    orderByClause = { precio: 'desc' };
  }

  const [totalItems, productosRaw, marcas, categorias, temporadas, config] = await Promise.all([
    prisma.producto.count({ where: whereClause }),
    prisma.producto.findMany({
      where: whereClause,
      include: {
        marca: {
          select: { codMarca: true, nombreMarca: true },
        },
        categoria: {
          select: { codCategoria: true, nombreCategoria: true },
        },
        descuento: true,
        productosTemporada: {
          where: { fechaHoraBajaPT: null },
          include: {
            temporada: {
              select: { codTemporada: true, nombreTemporada: true },
            },
          },
        },
        variantes: {
          where: { fechaHoraBajaVar: null },
          include: {
            talle: {
              select: { codTalle: true, nombreTalle: true, ordenVisualizacion: true },
            },
            color: {
              select: { codColor: true, nombreColor: true, codigoHex: true },
            },
          },
          orderBy: { talle: { ordenVisualizacion: 'asc' } },
        },
      },
      orderBy: orderByClause,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.marca.findMany({
      where: { fechaHoraBajaMarca: null },
      select: { codMarca: true, nombreMarca: true },
      orderBy: { nombreMarca: 'asc' },
    }),
    prisma.categoria.findMany({
      where: { fechaHoraBajaCat: null },
      select: { codCategoria: true, nombreCategoria: true },
      orderBy: { nombreCategoria: 'asc' },
    }),
    prisma.temporada.findMany({
      where: { fechaHoraBajaTemp: null },
      select: { codTemporada: true, nombreTemporada: true },
    }),
    prisma.configuracionTienda.findFirst(),
  ]);

  const ahora = new Date();

  // Sanitización estricta: Jamás exponemos precioCosto, porcentajeMarkup ni proveedores al público
  const productosPublicos = productosRaw.map((p) => {
    const pctDescuento = obtenerPorcentajeDescuentoVigente(p.descuento, ahora);
    const precioFinal = calcularPrecioNetoConDescuento(p.precio, pctDescuento);

    return {
      codProducto: p.codProducto,
      nombre: p.nombre,
      descripcion: p.descripcion,
      imagen: p.imagen,
      precioLista: p.precio,
      porcentajeDescuento: pctDescuento,
      nombrePromo: pctDescuento > 0 ? p.descuento?.nombreDesc ?? null : null,
      precioFinal,
      marca: p.marca,
      categoria: p.categoria,
      temporadas: p.productosTemporada.map((pt) => ({
        anio: pt.anio,
        nombreTemporada: pt.temporada.nombreTemporada,
      })),
      variantes: p.variantes.map((v) => ({
        codVariante: v.codVariante,
        sku: v.sku,
        stock: v.stock,
        imagenVariante: v.imagenVariante,
        talle: v.talle,
        color: v.color,
      })),
    };
  });

  return NextResponse.json({
    tienda: {
      nombreComercial: config?.nombreComercial ?? 'Tutina',
      logoUrl: config?.logoUrl ?? '/tutina-logo.svg',
      slogan: config?.slogan ?? 'Indumentaria Deportiva & Urbana',
      telefonoWhatsApp: config?.telefonoWhatsAppNotificaciones ?? '+5493516543210',
      direccionComercial: config?.direccionComercial ?? null,
      instagramHandle: config?.instagramHandle ?? '@tutina.indumentaria',
    },
    productos: productosPublicos,
    marcas,
    categorias,
    temporadas,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limit)),
    },
  });
}
