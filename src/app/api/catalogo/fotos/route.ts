import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  MAX_FOTOS_POR_COLOR,
  MENSAJE_FALTA_TABLA,
  calcularHuellaFoto,
  esFaltaTablaFotos,
  migrarFotosAnteriores,
  obtenerFotosAgrupadas,
  sincronizarPortadaColor,
  validarFotoSubida,
} from '@/lib/services/fotos.service';

// Galería de fotos por color de una prenda (panel de gestión, ruta protegida por el middleware).
// Cada cambio se guarda al instante y se ve en la tienda sin esperar al botón "Guardar cambios".
// Las fotos se suben de a una para no superar el límite de 4,5 MB por petición de Vercel.

function respuestaError(error: unknown, porDefecto: string) {
  if (esFaltaTablaFotos(error)) {
    return NextResponse.json({ error: MENSAJE_FALTA_TABLA, faltaActualizarBase: true }, { status: 503 });
  }
  const msg = error instanceof Error ? error.message : porDefecto;
  return NextResponse.json({ error: msg }, { status: 400 });
}

function numeroValido(valor: unknown): number | null {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Galería de la prenda agrupada por color, con los talles que comparte cada color. */
async function armarGaleria(codProducto: number) {
  const [variantes, fotos] = await Promise.all([
    prisma.varianteProducto.findMany({
      where: { codProducto, fechaHoraBajaVar: null },
      select: {
        codColor: true,
        color: { select: { codColor: true, nombreColor: true, codigoHex: true } },
        talle: { select: { nombreTalle: true, ordenVisualizacion: true } },
      },
      orderBy: [{ talle: { ordenVisualizacion: 'asc' } }, { codVariante: 'asc' }],
    }),
    obtenerFotosAgrupadas([codProducto]),
  ]);
  const fotosPorColor = fotos.get(codProducto) ?? new Map();
  const colores = new Map<
    number,
    { codColor: number; nombreColor: string; codigoHex: string; talles: string[] }
  >();
  for (const v of variantes) {
    const c = colores.get(v.codColor) ?? { ...v.color, talles: [] };
    if (!c.talles.includes(v.talle.nombreTalle)) c.talles.push(v.talle.nombreTalle);
    colores.set(v.codColor, c);
  }
  // Colores con fotos pero sin talles activos (por ejemplo, recién quitados)
  const sinTalles = [...fotosPorColor.keys()].filter((cod) => !colores.has(cod));
  if (sinTalles.length > 0) {
    const extra = await prisma.color.findMany({
      where: { codColor: { in: sinTalles } },
      select: { codColor: true, nombreColor: true, codigoHex: true },
    });
    for (const c of extra) colores.set(c.codColor, { ...c, talles: [] });
  }
  return {
    codProducto,
    maxFotosPorColor: MAX_FOTOS_POR_COLOR,
    colores: [...colores.values()].map((c) => ({ ...c, fotos: fotosPorColor.get(c.codColor) ?? [] })),
  };
}

export async function GET(request: Request) {
  try {
    const codProducto = numeroValido(new URL(request.url).searchParams.get('codProducto'));
    if (!codProducto) {
      return NextResponse.json({ error: 'Prenda inválida.' }, { status: 400 });
    }
    // La primera vez, la foto única de cada talle (sistema anterior) pasa a la galería
    const migradas = await migrarFotosAnteriores(codProducto);
    if (migradas > 0) revalidatePath('/tienda');
    return NextResponse.json(await armarGaleria(codProducto));
  } catch (error) {
    return respuestaError(error, 'No se pudieron cargar las fotos.');
  }
}

/** Agrega una foto al final de la galería de un color. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const codProducto = numeroValido(body.codProducto);
    const codColor = numeroValido(body.codColor);
    if (!codProducto || !codColor) {
      return NextResponse.json({ error: 'Falta la prenda o el color.' }, { status: 400 });
    }
    const errorFoto = validarFotoSubida(body.imagen);
    if (errorFoto) return NextResponse.json({ error: errorFoto }, { status: 400 });
    const imagen = String(body.imagen);

    const [producto, color] = await Promise.all([
      prisma.producto.findUnique({ where: { codProducto }, select: { codProducto: true } }),
      prisma.color.findUnique({ where: { codColor }, select: { codColor: true } }),
    ]);
    if (!producto || !color) {
      return NextResponse.json({ error: 'La prenda o el color no existen.' }, { status: 404 });
    }

    await migrarFotosAnteriores(codProducto);
    const foto = await prisma.$transaction(async (tx) => {
      const existentes = await tx.fotoProductoColor.aggregate({
        where: { codProducto, codColor },
        _count: true,
        _max: { orden: true },
      });
      if (existentes._count >= MAX_FOTOS_POR_COLOR) {
        throw new Error(`Cada color admite hasta ${MAX_FOTOS_POR_COLOR} fotos.`);
      }
      const creada = await tx.fotoProductoColor.create({
        data: {
          codProducto,
          codColor,
          imagen,
          huella: calcularHuellaFoto(imagen),
          orden: (existentes._max.orden ?? -1) + 1,
        },
        select: { idFoto: true },
      });
      if (existentes._count === 0) await sincronizarPortadaColor(codProducto, codColor, tx);
      return creada;
    });

    revalidatePath('/tienda');
    return NextResponse.json({ idFoto: foto.idFoto, galeria: await armarGaleria(codProducto) });
  } catch (error) {
    return respuestaError(error, 'No se pudo guardar la foto.');
  }
}

/** Cambia el orden de las fotos de un color. La primera queda como portada. */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const codProducto = numeroValido(body.codProducto);
    const codColor = numeroValido(body.codColor);
    const orden: number[] = Array.isArray(body.orden)
      ? body.orden.map(Number).filter((n: number) => Number.isInteger(n) && n > 0)
      : [];
    if (!codProducto || !codColor || orden.length === 0) {
      return NextResponse.json({ error: 'Datos de orden inválidos.' }, { status: 400 });
    }
    await prisma.$transaction(async (tx) => {
      const actuales = await tx.fotoProductoColor.findMany({
        where: { codProducto, codColor },
        select: { idFoto: true },
      });
      const ids = new Set(actuales.map((f) => f.idFoto));
      if (orden.length !== ids.size || orden.some((id) => !ids.has(id))) {
        throw new Error('Las fotos cambiaron mientras tanto. Volvé a abrir la galería.');
      }
      for (let i = 0; i < orden.length; i++) {
        await tx.fotoProductoColor.update({ where: { idFoto: orden[i] }, data: { orden: i } });
      }
      await sincronizarPortadaColor(codProducto, codColor, tx);
    });
    revalidatePath('/tienda');
    return NextResponse.json({ galeria: await armarGaleria(codProducto) });
  } catch (error) {
    return respuestaError(error, 'No se pudo cambiar el orden.');
  }
}

/** Elimina una foto. Si era la portada, la siguiente pasa a ser la portada. */
export async function DELETE(request: Request) {
  try {
    const idFoto = numeroValido(new URL(request.url).searchParams.get('idFoto'));
    if (!idFoto) return NextResponse.json({ error: 'Foto inválida.' }, { status: 400 });
    const foto = await prisma.fotoProductoColor.findUnique({
      where: { idFoto },
      select: { codProducto: true, codColor: true },
    });
    if (!foto) return NextResponse.json({ error: 'La foto ya no existe.' }, { status: 404 });
    await prisma.$transaction(async (tx) => {
      await tx.fotoProductoColor.delete({ where: { idFoto } });
      await sincronizarPortadaColor(foto.codProducto, foto.codColor, tx);
    });
    revalidatePath('/tienda');
    return NextResponse.json({ galeria: await armarGaleria(foto.codProducto) });
  } catch (error) {
    return respuestaError(error, 'No se pudo eliminar la foto.');
  }
}
