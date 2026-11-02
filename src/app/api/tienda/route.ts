import { NextResponse } from 'next/server';
import { obtenerVidrieraPublica } from '@/lib/services/tienda.service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const datos = await obtenerVidrieraPublica({
    page: Number(searchParams.get('page') || 1),
    limit: Number(searchParams.get('limit') || 12),
    q: searchParams.get('q') || '',
    codCategoria: searchParams.get('codCategoria'),
    codMarca: searchParams.get('codMarca'),
    codTemporada: searchParams.get('codTemporada'),
    orden: searchParams.get('orden'),
  });

  return NextResponse.json(datos, {
    headers: {
      // La CDN de Vercel sirve la respuesta desde caché y la renueva en segundo plano
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
