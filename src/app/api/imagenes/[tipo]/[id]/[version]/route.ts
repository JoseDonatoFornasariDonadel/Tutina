import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { ADMIN_COOKIE_NAME, verificarTokenSesionAdmin } from '@/lib/auth';
import { esFaltaTablaFotos } from '@/lib/services/fotos.service';

// Sirve como archivo las imágenes guardadas en la base en formato base64 (data URL).
// La URL incluye una huella del contenido (version), así que la respuesta se puede
// cachear sin vencimiento: cuando la foto cambia, la tienda pide otra URL.

const CACHE_INMUTABLE = 'public, max-age=31536000, immutable';
// Fotos de prendas ocultas o dadas de baja: solo para el panel, sin caché compartida
const CACHE_PANEL = 'private, max-age=31536000, immutable';

function decodificarDataUrl(valor: string): { tipo: string; datos: Buffer } | null {
  const match = /^data:([^;,]+)?((?:;[^;,]+)*?)(;base64)?,(.*)$/s.exec(valor);
  if (!match) return null;
  const tipo = match[1] || 'application/octet-stream';
  if (!tipo.startsWith('image/')) return null;
  const datos = match[3]
    ? Buffer.from(match[4], 'base64')
    : Buffer.from(decodeURIComponent(match[4]), 'utf8');
  return { tipo, datos };
}

async function obtenerValorImagen(
  tipo: string,
  id: number,
  soloVisibles = true
): Promise<string | null> {
  if (tipo === 'producto') {
    const prod = await prisma.producto.findFirst({
      where: soloVisibles
        ? { codProducto: id, fechaHoraBajaProd: null, visibleEnTiendaOnline: true }
        : { codProducto: id },
      select: { imagen: true },
    });
    return prod?.imagen ?? null;
  }
  if (tipo === 'variante') {
    const variante = await prisma.varianteProducto.findFirst({
      where: soloVisibles
        ? {
            codVariante: id,
            fechaHoraBajaVar: null,
            producto: { fechaHoraBajaProd: null, visibleEnTiendaOnline: true },
          }
        : { codVariante: id },
      select: { imagenVariante: true },
    });
    return variante?.imagenVariante ?? null;
  }
  if (tipo === 'foto') {
    // Galería de fotos por color de una prenda
    try {
      const foto = await prisma.fotoProductoColor.findFirst({
        where: soloVisibles
          ? {
              idFoto: id,
              producto: { fechaHoraBajaProd: null, visibleEnTiendaOnline: true },
            }
          : { idFoto: id },
        select: { imagen: true },
      });
      return foto?.imagen ?? null;
    } catch (error) {
      if (esFaltaTablaFotos(error)) return null;
      throw error;
    }
  }
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tipo: string; id: string; version: string }> }
) {
  const { tipo, id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum <= 0) {
    return new NextResponse('Imagen no encontrada', { status: 404 });
  }

  let valor = await obtenerValorImagen(tipo, idNum);
  let cache = CACHE_INMUTABLE;
  if (!valor) {
    // El panel también muestra prendas ocultas: con sesión de administración se sirven igual
    const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
    if (await verificarTokenSesionAdmin(token)) {
      valor = await obtenerValorImagen(tipo, idNum, false);
      cache = CACHE_PANEL;
    }
  }
  if (!valor) {
    return new NextResponse('Imagen no encontrada', { status: 404 });
  }

  // Si la imagen es un link externo, redirigimos a ese link
  if (/^https?:\/\//i.test(valor)) {
    return NextResponse.redirect(valor, 307);
  }

  const imagen = decodificarDataUrl(valor);
  if (!imagen) {
    return new NextResponse('Imagen no encontrada', { status: 404 });
  }

  return new NextResponse(new Uint8Array(imagen.datos), {
    headers: {
      'Content-Type': imagen.tipo,
      'Content-Length': String(imagen.datos.length),
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
      // Evita que una imagen SVG abierta directamente pueda ejecutar código
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
