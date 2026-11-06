import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  evaluarReseteoAlertaStock,
  evaluarYDispararAlertaStock,
} from '@/lib/services/whatsapp.service';
import { mapearTextoAColorHex } from '@/lib/colores';
import { urlImagenPublica } from '@/lib/services/tienda.service';
import {
  esFaltaTablaFotos,
  migrarFotosAnteriores,
  sincronizarPortadasDeLaPrenda,
} from '@/lib/services/fotos.service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const all = searchParams.get('all') === 'true';
  // ligero=1: las fotos van como URL corta en vez de base64 (para listados de selección)
  const ligero = searchParams.get('ligero') === '1';
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.max(1, Number(searchParams.get('limit') || 12));
  const q = (searchParams.get('q') || '').trim();
  const codCategoria = searchParams.get('codCategoria');
  const codMarca = searchParams.get('codMarca');
  const codTemporada = searchParams.get('codTemporada');
  const ordenAntiguedad = searchParams.get('ordenAntiguedad') || 'MAS_RECIENTES';

  const whereClause: Prisma.ProductoWhereInput = {
    fechaHoraBajaProd: null,
    ...(q
      ? {
          OR: [
            { nombre: { contains: q, mode: 'insensitive' } },
            { descripcion: { contains: q, mode: 'insensitive' } },
            { variantes: { some: { sku: { contains: q, mode: 'insensitive' } } } },
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

  // Orden por antigüedad: codProducto descendente = Más recientes primero, ascendente = Más antiguas primero
  const orderByClause: Prisma.ProductoOrderByWithRelationInput = {
    codProducto: ordenAntiguedad === 'MAS_ANTIGUAS' ? 'asc' : 'desc',
  };

  const [
    totalItems,
    productos,
    marcas,
    categorias,
    temporadas,
    descuentos,
    proveedores,
    talles,
    colores,
    config,
  ] = await Promise.all([
    prisma.producto.count({ where: whereClause }),
    prisma.producto.findMany({
      where: whereClause,
      include: {
        marca: true,
        categoria: true,
        descuento: true,
        proveedorHabitual: true,
        productosTemporada: {
          where: { fechaHoraBajaPT: null },
          include: { temporada: true },
        },
        variantes: {
          where: { fechaHoraBajaVar: null },
          include: { talle: true, color: true },
          orderBy: { talle: { ordenVisualizacion: 'asc' } },
        },
        historialPrecios: {
          orderBy: { fechaRegistro: 'desc' },
          take: 5,
        },
      },
      orderBy: orderByClause,
      ...(all
        ? {}
        : {
            skip: (page - 1) * limit,
            take: limit,
          }),
    }),
    prisma.marca.findMany({
      where: { fechaHoraBajaMarca: null },
      include: {
        productos: {
          where: { fechaHoraBajaProd: null },
          select: { codProducto: true, nombre: true },
        },
      },
      orderBy: { nombreMarca: 'asc' },
    }),
    prisma.categoria.findMany({
      where: { fechaHoraBajaCat: null },
      orderBy: { nombreCategoria: 'asc' },
    }),
    prisma.temporada.findMany({ where: { fechaHoraBajaTemp: null } }),
    prisma.descuento.findMany({ where: { fechaHoraBajaDesc: null } }),
    prisma.proveedor.findMany({ where: { fechaHoraBajaProv: null } }),
    prisma.talle.findMany({
      where: { fechaHoraBajaTalle: null },
      orderBy: { ordenVisualizacion: 'asc' },
    }),
    prisma.color.findMany({ where: { fechaHoraBajaColor: null } }),
    prisma.configuracionTienda.findFirst(),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  const productosRespuesta = ligero
    ? productos.map((p) => ({
        ...p,
        imagen: urlImagenPublica('producto', p.codProducto, p.imagen) ?? '',
        variantes: p.variantes.map((v) => ({
          ...v,
          imagenVariante: urlImagenPublica('variante', v.codVariante, v.imagenVariante),
        })),
      }))
    : productos;

  return NextResponse.json({
    productos: productosRespuesta,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
    },
    marcas,
    categorias,
    temporadas,
    descuentos,
    proveedores,
    talles,
    colores,
    config,
  });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    // Edición de una Marca existente
    if (body.tipoEdicion === 'MARCA') {
      if (!body.codMarca || !body.nombreMarca) {
        return NextResponse.json(
          { error: 'Código y nombre de la marca son obligatorios.' },
          { status: 400 }
        );
      }
      const marcaAct = await prisma.marca.update({
        where: { codMarca: Number(body.codMarca) },
        data: { nombreMarca: String(body.nombreMarca).trim() },
      });
      revalidatePath('/tienda');
      return NextResponse.json(marcaAct);
    }

    const {
      codProducto,
      nombre,
      descripcion,
      imagen,
      precioCosto,
      porcentajeMarkup,
      precio,
      codMarca,
      codCategoria,
      codDescuento,
      codProveedorHabitual,
      visibleEnTiendaOnline,
      variantes,
    } = body;

    const resultado = await prisma.$transaction(async (tx) => {
      const productoPrevio = await tx.producto.findUnique({
        where: { codProducto: Number(codProducto) },
      });

      if (!productoPrevio) {
        throw new Error('Producto no encontrado');
      }

      const descuentoFinal =
        codDescuento !== null &&
        codDescuento !== undefined &&
        codDescuento !== '' &&
        Number(codDescuento) > 0
          ? Number(codDescuento)
          : null;

      const proveedorFinal =
        codProveedorHabitual !== null &&
        codProveedorHabitual !== undefined &&
        codProveedorHabitual !== '' &&
        Number(codProveedorHabitual) > 0
          ? Number(codProveedorHabitual)
          : null;

      const prodActualizado = await tx.producto.update({
        where: { codProducto: Number(codProducto) },
        data: {
          nombre,
          descripcion,
          imagen,
          precioCosto: Number(precioCosto),
          porcentajeMarkup: Number(porcentajeMarkup),
          precio: Number(precio),
          codMarca: Number(codMarca),
          codCategoria: Number(codCategoria),
          codDescuento: descuentoFinal,
          codProveedorHabitual: proveedorFinal,
          visibleEnTiendaOnline: Boolean(visibleEnTiendaOnline ?? true),
        },
      });

      if (
        productoPrevio.precioCosto !== Number(precioCosto) ||
        productoPrevio.porcentajeMarkup !== Number(porcentajeMarkup) ||
        productoPrevio.precio !== Number(precio)
      ) {
        await tx.historialPrecioProducto.create({
          data: {
            codProducto: prodActualizado.codProducto,
            precioCosto: Number(precioCosto),
            porcentajeMarkup: Number(porcentajeMarkup),
            precioVenta: Number(precio),
            motivo: 'Edición manual de costo/markup en Catálogo',
          },
        });
      }

      const alertasDisparadas = [];

      if (Array.isArray(variantes)) {
        for (const v of variantes) {
          if (v.codVariante) {
            await tx.varianteProducto.update({
              where: { codVariante: Number(v.codVariante) },
              data: {
                stock: Number(v.stock),
                codTalle: v.codTalle ? Number(v.codTalle) : undefined,
                codColor: v.codColor ? Number(v.codColor) : undefined,
                imagenVariante: v.imagenVariante !== undefined ? v.imagenVariante : undefined,
                sku: v.sku || undefined,
              },
            });

            await evaluarReseteoAlertaStock(tx, Number(v.codVariante));
            const resAlerta = await evaluarYDispararAlertaStock(
              tx,
              Number(v.codVariante),
              'AJUSTE_CATALOGO'
            );
            if (resAlerta.disparada) {
              alertasDisparadas.push(resAlerta);
            }
          } else {
            const skuNuevo =
              v.sku ||
              `TUT-${prodActualizado.codProducto}-${v.codTalle}-${v.codColor}-${Math.floor(
                100 + Math.random() * 900
              )}`;
            const creada = await tx.varianteProducto.create({
              data: {
                codProducto: prodActualizado.codProducto,
                codTalle: Number(v.codTalle),
                codColor: Number(v.codColor),
                stock: Number(v.stock ?? 0),
                imagenVariante: v.imagenVariante || null,
                sku: skuNuevo,
                alertaStockEnviada: Number(v.stock ?? 0) < 3,
              },
            });
            const resAlerta = await evaluarYDispararAlertaStock(
              tx,
              creada.codVariante,
              'ALTA_VARIANTE_EDICION'
            );
            if (resAlerta.disparada) {
              alertasDisparadas.push(resAlerta);
            }
          }
        }
      }

      return { producto: prodActualizado, alertasDisparadas };
    });

    // Los talles nuevos o que cambiaron de color toman la portada de la galería de su color
    await sincronizarPortadasDeLaPrenda(resultado.producto.codProducto);

    revalidatePath('/tienda');
    return NextResponse.json(resultado);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al actualizar el producto';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Alta de Nueva Marca
    if (body.tipoAlta === 'MARCA') {
      if (!body.nombreMarca || !String(body.nombreMarca).trim()) {
        return NextResponse.json(
          { error: 'El nombre de la marca es obligatorio.' },
          { status: 400 }
        );
      }
      const nuevaMarca = await prisma.marca.create({
        data: {
          nombreMarca: String(body.nombreMarca).trim(),
        },
      });
      return NextResponse.json(nuevaMarca);
    }

    // 1b. Alta de Nueva Categoría (desde los selectores con "Crear: ...")
    if (body.tipoAlta === 'CATEGORIA') {
      const nombreCategoria = String(body.nombreCategoria || '')
        .trim()
        .replace(/\s+/g, ' ');
      if (!nombreCategoria) {
        return NextResponse.json(
          { error: 'El nombre de la categoría es obligatorio.' },
          { status: 400 }
        );
      }
      if (nombreCategoria.length > 60) {
        return NextResponse.json(
          { error: 'El nombre de la categoría no puede superar los 60 caracteres.' },
          { status: 400 }
        );
      }

      // Si ya existe con ese nombre (sin distinguir mayúsculas), se reutiliza
      const existente = await prisma.categoria.findFirst({
        where: { nombreCategoria: { equals: nombreCategoria, mode: 'insensitive' } },
        orderBy: { fechaHoraBajaCat: { sort: 'asc', nulls: 'first' } },
      });
      if (existente) {
        const categoria = existente.fechaHoraBajaCat
          ? await prisma.categoria.update({
              where: { codCategoria: existente.codCategoria },
              data: { fechaHoraBajaCat: null },
            })
          : existente;
        revalidatePath('/tienda');
        return NextResponse.json(categoria);
      }

      const config = await prisma.configuracionTienda.findFirst({
        select: { markupPorDefectoGlobal: true },
      });
      const markupBody = Number(body.markupPorDefectoCategoria);
      const nuevaCategoria = await prisma.categoria.create({
        data: {
          nombreCategoria,
          markupPorDefectoCategoria:
            Number.isFinite(markupBody) && markupBody > 0
              ? markupBody
              : config?.markupPorDefectoGlobal ?? 120,
          ...(typeof body.rubro === 'string' && body.rubro.trim()
            ? { rubro: body.rubro.trim() }
            : {}),
        },
      });
      // La tienda muestra todas las categorías activas en sus filtros
      revalidatePath('/tienda');
      return NextResponse.json(nuevaCategoria);
    }

    // 2. Alta de Nuevo Descuento
    if (body.tipoAlta === 'DESCUENTO') {
      const nuevoDesc = await prisma.descuento.create({
        data: {
          nombreDesc: body.nombreDesc,
          descripcionDesc: body.descripcionDesc || '',
          porcentajeDesc: Number(body.porcentajeDesc),
          fechaInicioDesc: new Date(body.fechaInicioDesc),
          fechaFinDesc: new Date(body.fechaFinDesc),
          activoEnTiendaOnline: true,
        },
      });
      return NextResponse.json(nuevoDesc);
    }

    // 3. Alta de Nuevo Color (desde el selector con buscador del catálogo)
    if (body.tipoAlta === 'COLOR') {
      const nombreColor = String(body.nombreColor || '').trim();
      if (!nombreColor) {
        return NextResponse.json(
          { error: 'El nombre del color es obligatorio.' },
          { status: 400 }
        );
      }
      const hexValido = mapearTextoAColorHex(nombreColor, String(body.codigoHex || ''));

      // Si ya existe un color con ese nombre (sin distinguir mayúsculas), se reutiliza
      const existente = await prisma.color.findFirst({
        where: { nombreColor: { equals: nombreColor, mode: 'insensitive' } },
      });
      if (existente) {
        const color = await prisma.color.update({
          where: { codColor: existente.codColor },
          data: {
            fechaHoraBajaColor: null,
            // Se respeta el tono que ya tenía el color; solo se corrige si era el genérico
            codigoHex: mapearTextoAColorHex(existente.nombreColor, existente.codigoHex),
          },
        });
        return NextResponse.json(color);
      }

      const nuevoColor = await prisma.color.create({
        data: { nombreColor, codigoHex: hexValido },
      });
      return NextResponse.json(nuevoColor);
    }

    // 4. Alta de Nueva Prenda con su Lista de Variantes (Talle, Color, Stock e Imagen)
    let marcaValida = body.codMarca
      ? await prisma.marca.findUnique({ where: { codMarca: Number(body.codMarca) } })
      : null;
    if (!marcaValida) {
      marcaValida = await prisma.marca.findFirst({ where: { fechaHoraBajaMarca: null } });
    }
    if (!marcaValida) {
      marcaValida = await prisma.marca.create({ data: { nombreMarca: 'Tutina Fit' } });
    }

    let categoriaValida = body.codCategoria
      ? await prisma.categoria.findUnique({ where: { codCategoria: Number(body.codCategoria) } })
      : null;
    if (!categoriaValida) {
      categoriaValida = await prisma.categoria.findFirst({ where: { fechaHoraBajaCat: null } });
    }
    if (!categoriaValida) {
      categoriaValida = await prisma.categoria.create({
        data: { nombreCategoria: 'Indumentaria General', markupPorDefectoCategoria: 120 },
      });
    }

    let temporadaValida = body.codTemporada
      ? await prisma.temporada.findUnique({ where: { codTemporada: Number(body.codTemporada) } })
      : null;
    if (!temporadaValida) {
      temporadaValida = await prisma.temporada.findFirst({ where: { fechaHoraBajaTemp: null } });
    }

    const descuentoValido =
      body.codDescuento && Number(body.codDescuento) > 0
        ? await prisma.descuento.findUnique({ where: { codDescuento: Number(body.codDescuento) } })
        : null;

    const proveedorValido =
      body.codProveedorHabitual && Number(body.codProveedorHabitual) > 0
        ? await prisma.proveedor.findUnique({
            where: { codProveedor: Number(body.codProveedorHabitual) },
          })
        : null;

    const talleDefault =
      (await prisma.talle.findFirst({ where: { fechaHoraBajaTalle: null } })) ||
      (await prisma.talle.create({ data: { nombreTalle: 'M' } }));
    const colorDefault =
      (await prisma.color.findFirst({ where: { fechaHoraBajaColor: null } })) ||
      (await prisma.color.create({ data: { nombreColor: 'Negro', codigoHex: '#18181B' } }));

    const variantesInput =
      Array.isArray(body.variantes) && body.variantes.length > 0
        ? body.variantes
        : [
            {
              codTalle: talleDefault.codTalle,
              codColor: colorDefault.codColor,
              stock: 5,
              imagenVariante: null,
            },
          ];

    const prefijoPrenda =
      String(body.nombre || 'TUT')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, 4) || 'TUT';

    const variantesValidadas = [];
    for (let idx = 0; idx < variantesInput.length; idx++) {
      const v = variantesInput[idx];
      const talleCheck = v.codTalle
        ? await prisma.talle.findUnique({ where: { codTalle: Number(v.codTalle) } })
        : null;
      const colorCheck = v.codColor
        ? await prisma.color.findUnique({ where: { codColor: Number(v.codColor) } })
        : null;

      const talleFinal = talleCheck || talleDefault;
      const colorFinal = colorCheck || colorDefault;

      const colorCode = colorFinal.nombreColor
        .replace(/[^a-zA-Z]/g, '')
        .toUpperCase()
        .slice(0, 3);
      let skuCandidato = v.sku
        ? String(v.sku).trim()
        : `TUT-${prefijoPrenda}-${talleFinal.nombreTalle}-${colorCode}-${Math.floor(
            100 + Math.random() * 900
          )}`;

      const skuExiste = await prisma.varianteProducto.findUnique({
        where: { sku: skuCandidato },
      });
      if (skuExiste) {
        skuCandidato = `${skuCandidato}-${idx + 1}${Math.floor(10 + Math.random() * 89)}`;
      }

      variantesValidadas.push({
        sku: skuCandidato,
        codTalle: talleFinal.codTalle,
        codColor: colorFinal.codColor,
        stock: Number(v.stock ?? 0),
        imagenVariante: v.imagenVariante || null,
        alertaStockEnviada: Number(v.stock ?? 0) < 3,
      });
    }

    // Reutilizar automáticamente la imagen cargada entre variantes del mismo color.
    // El panel manda cada foto una sola vez por color (para no superar el límite de 4,5 MB
    // por petición de Vercel) y acá se copia a los demás talles de ese color.
    const imagenPorColor = new Map<number, string>();
    for (const v of variantesValidadas) {
      if (v.imagenVariante && !imagenPorColor.has(v.codColor)) {
        imagenPorColor.set(v.codColor, v.imagenVariante);
      }
    }
    for (const v of variantesValidadas) {
      if (!v.imagenVariante && imagenPorColor.has(v.codColor)) {
        v.imagenVariante = imagenPorColor.get(v.codColor) || null;
      }
    }

    const primeraImagenVariante = variantesValidadas.find((v) => v.imagenVariante)?.imagenVariante;
    // fotosPendientes: el panel sube la galería de cada color justo después de crear la
    // prenda; la primera foto que llegue pasa a ser la foto principal.
    const imagenPrincipalPrenda =
      primeraImagenVariante ||
      body.imagen ||
      (body.fotosPendientes
        ? ''
        : 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80');

    const nuevoProd = await prisma.producto.create({
      data: {
        nombre: String(body.nombre).trim(),
        descripcion: body.descripcion ? String(body.descripcion).trim() : '',
        imagen: imagenPrincipalPrenda,
        precioCosto: Number(body.precioCosto),
        porcentajeMarkup: Number(body.porcentajeMarkup),
        precio: Number(body.precio),
        codMarca: marcaValida.codMarca,
        codCategoria: categoriaValida.codCategoria,
        codDescuento: descuentoValido ? descuentoValido.codDescuento : null,
        codProveedorHabitual: proveedorValido ? proveedorValido.codProveedor : null,
        visibleEnTiendaOnline: body.visibleEnTiendaOnline === false ? false : true,
        productosTemporada: temporadaValida
          ? {
              create: [
                { anio: new Date().getFullYear(), codTemporada: temporadaValida.codTemporada },
              ],
            }
          : undefined,
        historialPrecios: {
          create: [
            {
              precioCosto: Number(body.precioCosto),
              porcentajeMarkup: Number(body.porcentajeMarkup),
              precioVenta: Number(body.precio),
              motivo: 'Alta inicial en catálogo',
            },
          ],
        },
        variantes: {
          create: variantesValidadas,
        },
      },
      include: {
        marca: true,
        categoria: true,
        variantes: { include: { talle: true, color: true } },
      },
    });

    // La foto cargada para cada color pasa a ser la primera de su galería
    try {
      await migrarFotosAnteriores(nuevoProd.codProducto);
    } catch (error) {
      if (!esFaltaTablaFotos(error)) throw error;
    }

    revalidatePath('/tienda');
    return NextResponse.json(nuevoProd);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al crear registro en catálogo';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Eliminación de una prenda
    const codProducto = Number(searchParams.get('codProducto'));
    if (codProducto) {
      const resultado = await eliminarProducto(codProducto);
      revalidatePath('/tienda');
      return NextResponse.json(resultado);
    }

    const codMarca = Number(searchParams.get('codMarca'));
    if (!codMarca) {
      return NextResponse.json({ error: 'Código de marca inválido' }, { status: 400 });
    }

    await prisma.marca.update({
      where: { codMarca },
      data: { fechaHoraBajaMarca: new Date() },
    });

    revalidatePath('/tienda');
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al eliminar';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/**
 * Elimina una prenda.
 * - Si nunca se vendió ni ingresó en una factura, se borra definitivamente junto con
 *   sus variantes (stock e imágenes), historial de precios, temporadas y alertas.
 * - Si tiene ventas o ingresos registrados, borrarla rompería los pedidos, facturas y
 *   reportes. En ese caso se da de baja: desaparece del panel y de la tienda, pero el
 *   historial queda intacto.
 */
async function eliminarProducto(codProducto: number) {
  return prisma.$transaction(async (tx) => {
    const producto = await tx.producto.findUnique({
      where: { codProducto },
      include: { variantes: { select: { codVariante: true } } },
    });
    if (!producto) {
      throw new Error('Prenda no encontrada.');
    }

    const codVariantes = producto.variantes.map((v) => v.codVariante);
    const [ventas, ingresos] = await Promise.all([
      tx.detallePedido.count({ where: { codVariante: { in: codVariantes } } }),
      tx.detalleIngreso.count({ where: { codVariante: { in: codVariantes } } }),
    ]);

    if (ventas > 0 || ingresos > 0) {
      const ahora = new Date();
      await tx.varianteProducto.updateMany({
        where: { codProducto, fechaHoraBajaVar: null },
        data: { fechaHoraBajaVar: ahora },
      });
      await tx.producto.update({
        where: { codProducto },
        data: { fechaHoraBajaProd: ahora, visibleEnTiendaOnline: false },
      });
      return { ok: true, modo: 'BAJA' as const, ventas, ingresos };
    }

    await tx.alertaWhatsAppLog.deleteMany({ where: { codVariante: { in: codVariantes } } });
    await tx.varianteProducto.deleteMany({ where: { codProducto } });
    await tx.historialPrecioProducto.deleteMany({ where: { codProducto } });
    await tx.productoTemporada.deleteMany({ where: { codProducto } });
    await tx.producto.delete({ where: { codProducto } });
    return { ok: true, modo: 'ELIMINADA' as const, ventas: 0, ingresos: 0 };
  });
}
