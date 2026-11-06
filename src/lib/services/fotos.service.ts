import { createHash } from 'crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Fotos por color: una prenda tiene una galería de fotos por cada color, y todos los talles
 * de ese color la comparten (Remera Roja S, M y L muestran las mismas fotos).
 *
 * Tabla FotoProductoColor (codProducto + codColor + orden). La foto con menor "orden" es la
 * portada del color, y se copia a VarianteProducto.imagenVariante de cada talle: así pedidos,
 * facturas, alertas y la grilla de la tienda siguen funcionando sin cambios.
 */

export const MAX_FOTOS_POR_COLOR = 10;

type Cliente = PrismaClient | Prisma.TransactionClient;

export interface FotoPublica {
  idFoto: number;
  url: string;
}

/** Huella del contenido + extensión. Si la foto cambia, cambia la URL (caché inmutable). */
export function calcularHuellaFoto(imagen: string): string {
  const huella = createHash('sha1').update(imagen).digest('hex').slice(0, 12);
  return imagen.startsWith('data:image/svg') ? `${huella}.svg` : huella;
}

/** URL corta para mostrar la foto (las externas se usan tal cual). */
export function urlFoto(foto: { idFoto: number; huella: string; externa?: string | null }): string {
  if (foto.externa) return foto.externa;
  return `/api/imagenes/foto/${foto.idFoto}/${foto.huella || 'v'}`;
}

/**
 * La tabla nueva todavía no existe en la base (falta correr `npm run db:push`).
 * En ese caso la app sigue funcionando con la foto única de cada talle.
 */
export function esFaltaTablaFotos(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2021' || error.code === 'P2022')
  );
}

export const MENSAJE_FALTA_TABLA =
  'Para cargar varias fotos por color hay que actualizar la base de datos: ejecutá "npm run db:push" y luego "npm run db:rls".';

/**
 * Fotos de varias prendas agrupadas por prenda y color, sin traer el contenido base64
 * (solo id y huella). Devuelve un mapa vacío si la tabla todavía no existe.
 */
export async function obtenerFotosAgrupadas(
  codProductos: number[],
  cliente: Cliente = prisma
): Promise<Map<number, Map<number, FotoPublica[]>>> {
  const resultado = new Map<number, Map<number, FotoPublica[]>>();
  if (codProductos.length === 0) return resultado;
  try {
    const where = { codProducto: { in: codProductos } };
    const [fotos, externas] = await Promise.all([
      cliente.fotoProductoColor.findMany({
        where,
        select: { idFoto: true, codProducto: true, codColor: true, huella: true },
        orderBy: [{ orden: 'asc' }, { idFoto: 'asc' }],
      }),
      // Las fotos que son un link (no base64) son textos cortos: se traen para usarlas directo
      cliente.fotoProductoColor.findMany({
        where: { ...where, NOT: { imagen: { startsWith: 'data:' } } },
        select: { idFoto: true, imagen: true },
      }),
    ]);
    const linkPorId = new Map(externas.map((f) => [f.idFoto, f.imagen]));
    for (const f of fotos) {
      const porColor = resultado.get(f.codProducto) ?? new Map<number, FotoPublica[]>();
      const lista = porColor.get(f.codColor) ?? [];
      lista.push({ idFoto: f.idFoto, url: urlFoto({ ...f, externa: linkPorId.get(f.idFoto) }) });
      porColor.set(f.codColor, lista);
      resultado.set(f.codProducto, porColor);
    }
  } catch (error) {
    if (!esFaltaTablaFotos(error)) throw error;
  }
  return resultado;
}

/**
 * Migración automática: los colores que todavía no tienen galería, pero sí tenían la foto
 * única del sistema anterior (imagenVariante), pasan a tener esa foto como primera de la galería.
 * Es idempotente: solo actúa sobre colores sin fotos.
 */
export async function migrarFotosAnteriores(codProducto: number, cliente: Cliente = prisma) {
  const [variantes, conFotos] = await Promise.all([
    cliente.varianteProducto.findMany({
      where: { codProducto, fechaHoraBajaVar: null, imagenVariante: { not: null } },
      select: { codColor: true, imagenVariante: true },
      orderBy: { codVariante: 'asc' },
    }),
    cliente.fotoProductoColor.groupBy({ by: ['codColor'], where: { codProducto } }),
  ]);
  const coloresConFotos = new Set(conFotos.map((c) => c.codColor));
  const aCrear = new Map<number, string[]>();
  for (const v of variantes) {
    const img = v.imagenVariante?.trim();
    if (!img || coloresConFotos.has(v.codColor)) continue;
    const lista = aCrear.get(v.codColor) ?? [];
    if (!lista.includes(img) && lista.length < MAX_FOTOS_POR_COLOR) lista.push(img);
    aCrear.set(v.codColor, lista);
  }
  if (aCrear.size === 0) return 0;
  const filas = [...aCrear.entries()].flatMap(([codColor, imagenes]) =>
    imagenes.map((imagen, orden) => ({
      codProducto,
      codColor,
      imagen,
      huella: calcularHuellaFoto(imagen),
      orden,
    }))
  );
  await cliente.fotoProductoColor.createMany({ data: filas });
  // La primera foto de cada color queda como portada de todos sus talles
  for (const codColor of aCrear.keys()) {
    await sincronizarPortadaColor(codProducto, codColor, cliente);
  }
  return filas.length;
}

/**
 * Copia la portada del color (primera foto de la galería) a todos los talles de ese color.
 * Si el color se quedó sin fotos, los talles quedan sin foto.
 * Si la prenda usaba de foto principal una portada vieja (o no tenía), se actualiza también.
 */
export async function sincronizarPortadaColor(
  codProducto: number,
  codColor: number,
  cliente: Cliente = prisma
) {
  const [portada, anteriores, producto] = await Promise.all([
    cliente.fotoProductoColor.findFirst({
      where: { codProducto, codColor },
      orderBy: [{ orden: 'asc' }, { idFoto: 'asc' }],
      select: { imagen: true },
    }),
    cliente.varianteProducto.findMany({
      where: { codProducto, codColor },
      select: { imagenVariante: true },
    }),
    cliente.producto.findUnique({ where: { codProducto }, select: { imagen: true } }),
  ]);
  const nueva = portada?.imagen ?? null;
  await cliente.varianteProducto.updateMany({
    where: { codProducto, codColor },
    data: { imagenVariante: nueva },
  });

  // Foto principal de la prenda (tarjetas del catálogo y de la tienda)
  const imagenesViejas = new Set(anteriores.map((v) => v.imagenVariante).filter(Boolean));
  const principal = producto?.imagen ?? '';
  const principalEraDeEsteColor = imagenesViejas.has(principal);
  const principalVacia = !principal.trim();
  if (principalVacia || principalEraDeEsteColor) {
    const reemplazo = nueva ?? (await primeraPortadaDeLaPrenda(codProducto, cliente));
    if (reemplazo && reemplazo !== principal) {
      await cliente.producto.update({ where: { codProducto }, data: { imagen: reemplazo } });
    }
  }
}

async function primeraPortadaDeLaPrenda(codProducto: number, cliente: Cliente) {
  const foto = await cliente.fotoProductoColor.findFirst({
    where: { codProducto },
    orderBy: [{ codColor: 'asc' }, { orden: 'asc' }, { idFoto: 'asc' }],
    select: { imagen: true },
  });
  return foto?.imagen ?? null;
}

/**
 * Talles nuevos (o que cambiaron de color) toman la portada de su color, si ese color ya
 * tiene galería. Se usa al guardar la edición de una prenda.
 */
export async function sincronizarPortadasDeLaPrenda(codProducto: number, cliente: Cliente = prisma) {
  try {
    const colores = await cliente.fotoProductoColor.groupBy({
      by: ['codColor'],
      where: { codProducto },
    });
    for (const { codColor } of colores) {
      await sincronizarPortadaColor(codProducto, codColor, cliente);
    }
  } catch (error) {
    if (!esFaltaTablaFotos(error)) throw error;
  }
}

/** Valida una foto recibida desde el panel. Devuelve el texto de error o null si está bien. */
export function validarFotoSubida(imagen: unknown): string | null {
  if (typeof imagen !== 'string' || !imagen.trim()) return 'Falta la foto.';
  const esDataUrl = /^data:image\/(png|jpe?g|webp|gif|avif|svg\+xml);base64,/i.test(imagen);
  const esLink = /^https:\/\/\S+$/i.test(imagen);
  if (!esDataUrl && !esLink) return 'El archivo no es una imagen válida.';
  // ~3 MB de imagen en base64. Las fotos ya llegan comprimidas desde el navegador.
  if (imagen.length > 4_000_000) return 'La foto es demasiado pesada. Probá con otra más liviana.';
  return null;
}
