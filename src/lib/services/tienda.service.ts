import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  calcularPrecioNetoConDescuento,
  obtenerPorcentajeDescuentoVigente,
} from '@/lib/services/pricing.service';

export const PRENDAS_POR_PAGINA_TIENDA = 12;

export interface FiltrosVidriera {
  page?: number;
  limit?: number;
  q?: string;
  codCategoria?: string | null;
  codMarca?: string | null;
  codTemporada?: string | null;
  orden?: string | null;
}

/**
 * Las fotos subidas desde el panel se guardan en la base como texto base64 (data URL).
 * En vez de mandarlas dentro del JSON, se reemplazan por una URL corta que sirve la
 * imagen como archivo. La URL lleva una huella del contenido: si la foto cambia, cambia
 * la URL, así el navegador y el optimizador de Next pueden cachearla para siempre.
 */
export function urlImagenPublica(
  tipo: 'producto' | 'variante',
  id: number,
  valor: string | null | undefined
): string | null {
  if (!valor || !valor.trim()) return null;
  if (!valor.startsWith('data:')) return valor;
  const huella = createHash('sha1').update(valor).digest('hex').slice(0, 12);
  // Las SVG se marcan en la URL porque el optimizador de Next no las procesa
  const extension = valor.startsWith('data:image/svg') ? '.svg' : '';
  return `/api/imagenes/${tipo}/${id}/${huella}${extension}`;
}

export async function obtenerVidrieraPublica(filtros: FiltrosVidriera = {}) {
  const page = Math.max(1, Math.floor(Number(filtros.page) || 1));
  const limit = Math.min(48, Math.max(1, Math.floor(Number(filtros.limit) || PRENDAS_POR_PAGINA_TIENDA)));
  const q = (filtros.q || '').trim();
  const { codCategoria, codMarca, codTemporada } = filtros;
  const orden = filtros.orden || 'MAS_RECIENTES';

  const whereClause: Prisma.ProductoWhereInput = {
    fechaHoraBajaProd: null,
    // Las prendas marcadas como "No mostrar" quedan fuera de la tienda pública
    visibleEnTiendaOnline: true,
    ...(q
      ? {
          OR: [
            { nombre: { contains: q, mode: 'insensitive' } },
            { descripcion: { contains: q, mode: 'insensitive' } },
            { marca: { nombreMarca: { contains: q, mode: 'insensitive' } } },
            { categoria: { nombreCategoria: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
    // Filtro por categoría (clave foránea de Producto). Un valor inválido se ignora.
    ...(Number.isInteger(Number(codCategoria)) && Number(codCategoria) > 0
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
      imagen: urlImagenPublica('producto', p.codProducto, p.imagen) ?? '',
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
        imagenVariante: urlImagenPublica('variante', v.codVariante, v.imagenVariante),
        talle: v.talle,
        color: v.color,
      })),
    };
  });

  return {
    // Momento en que se armaron estos datos. La página de la tienda se regenera cuando el
    // panel cambia el catálogo, así que este valor cambia con cada cambio de datos.
    generadoEn: new Date().toISOString(),
    tienda: {
      nombreComercial: config?.nombreComercial ?? 'Tutina',
      logoUrl: config?.logoUrl ?? '/tutina-logo.svg',
      logoDarkUrl: config?.logoDarkUrl ?? null,
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
  };
}

export type VidrieraPublica = Awaited<ReturnType<typeof obtenerVidrieraPublica>>;
