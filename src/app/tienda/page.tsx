import { Suspense } from 'react';
import { TiendaCliente } from '@/components/tienda/TiendaCliente';
import { TiendaSkeleton } from '@/components/tienda/TiendaSkeleton';
import {
  obtenerVidrieraPublica,
  PRENDAS_POR_PAGINA_TIENDA,
} from '@/lib/services/tienda.service';

// ISR: Vercel sirve la página desde caché y la regenera como máximo cada 60 segundos.
// Además, el panel la regenera al instante cuando se edita el catálogo o la configuración.
export const revalidate = 60;

async function TiendaConDatos() {
  let datosIniciales = null;
  try {
    datosIniciales = await obtenerVidrieraPublica({
      page: 1,
      limit: PRENDAS_POR_PAGINA_TIENDA,
      orden: 'MAS_RECIENTES',
    });
  } catch (error) {
    // Si la base no responde (por ejemplo durante el build), la página carga los datos
    // desde el navegador como antes, en vez de fallar.
    console.error('No se pudo precargar la tienda:', error);
  }
  return <TiendaCliente datosIniciales={datosIniciales} />;
}

export default function TiendaPublicaPage() {
  return (
    <Suspense fallback={<TiendaSkeleton />}>
      <TiendaConDatos />
    </Suspense>
  );
}
