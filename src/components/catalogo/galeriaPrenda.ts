'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** Una foto de la galería de un color */
export interface FotoColor {
  idFoto: number;
  url: string;
}

/** Galería de un color de la prenda: la comparten todos sus talles */
export interface ColorGaleria {
  codColor: number;
  nombreColor: string;
  codigoHex: string;
  /** Talles guardados de ese color (S, M, L...) */
  talles: string[];
  fotos: FotoColor[];
}

export interface GaleriaPrenda {
  codProducto: number;
  maxFotosPorColor: number;
  colores: ColorGaleria[];
}

/**
 * Estado de la galería de fotos (por color) de la prenda que se está editando.
 * Se carga al abrir la edición; los paneles de fotos y variantes la comparten.
 */
export function useGaleriaPrenda(codProducto: number | null) {
  const [galeria, setGaleria] = useState<GaleriaPrenda | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // La base todavía no tiene la tabla de fotos por color
  const [faltaActualizarBase, setFaltaActualizarBase] = useState(false);

  const recargar = useCallback(async () => {
    if (!codProducto) return;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/catalogo/fotos?codProducto=${codProducto}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        setFaltaActualizarBase(Boolean(data.faltaActualizarBase));
        throw new Error(data.error || 'No se pudieron cargar las fotos.');
      }
      setFaltaActualizarBase(false);
      setGaleria(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las fotos.');
    } finally {
      setCargando(false);
    }
  }, [codProducto]);

  useEffect(() => {
    setGaleria(null);
    setError(null);
    if (codProducto) recargar();
  }, [codProducto, recargar]);

  return { galeria, setGaleria, cargando, error, faltaActualizarBase, recargar };
}

/** Fotos de un color (vacío si todavía no tiene) */
export function fotosDeColor(galeria: GaleriaPrenda | null, codColor: number | undefined) {
  if (!galeria || codColor === undefined) return [];
  return galeria.colores.find((c) => c.codColor === codColor)?.fotos ?? [];
}

/**
 * Acciones sobre la galería que usa el panel «Gestionar fotos».
 * - Prenda guardada: cada acción va al servidor y devuelve la galería actualizada.
 * - Prenda nueva (borrador): cada acción cambia el estado local y no devuelve nada.
 */
export interface AccionesGaleria {
  /** "guardado": se guarda al instante. "borrador": se guarda al crear la prenda. */
  modo: 'guardado' | 'borrador';
  agregar: (codColor: number, imagen: string) => Promise<GaleriaPrenda | void>;
  eliminar: (codColor: number, idFoto: number) => Promise<GaleriaPrenda | void>;
  /** Nuevo orden de las fotos del color (la primera es la portada) */
  ordenar: (codColor: number, orden: number[]) => Promise<GaleriaPrenda | void>;
}

async function pedirGaleria(url: string, init: RequestInit): Promise<GaleriaPrenda | void> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo guardar el cambio.');
  return data.galeria;
}

/** Acciones de una prenda que ya existe: cada cambio se guarda al instante. */
export function accionesGaleriaServidor(codProducto: number): AccionesGaleria {
  const json = { 'Content-Type': 'application/json' };
  return {
    modo: 'guardado',
    agregar: (codColor, imagen) =>
      pedirGaleria('/api/catalogo/fotos', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ codProducto, codColor, imagen }),
      }),
    eliminar: (_codColor, idFoto) =>
      pedirGaleria(`/api/catalogo/fotos?idFoto=${idFoto}`, { method: 'DELETE' }),
    ordenar: (codColor, orden) =>
      pedirGaleria('/api/catalogo/fotos', {
        method: 'PATCH',
        headers: json,
        body: JSON.stringify({ codProducto, codColor, orden }),
      }),
  };
}

export const MAX_FOTOS_POR_COLOR_BORRADOR = 10;

/**
 * Galería de una prenda que todavía no existe (formulario «Nueva prenda»).
 * Las fotos (ya comprimidas, en base64) quedan en memoria agrupadas por color, con ids
 * temporales negativos. Al crear la prenda se suben con `subirFotosBorrador`.
 */
export function useGaleriaBorrador(
  catalogoColores: { codColor: number; nombreColor: string; codigoHex: string }[]
) {
  const [fotosPorColor, setFotosPorColor] = useState<Record<number, FotoColor[]>>({});
  // Copia sincrónica: dos acciones seguidas siempre ven el último estado
  const refFotos = useRef(fotosPorColor);
  const siguienteId = useRef(-1);

  const actualizar = useCallback((cambio: (prev: Record<number, FotoColor[]>) => Record<number, FotoColor[]>) => {
    refFotos.current = cambio(refFotos.current);
    setFotosPorColor(refFotos.current);
  }, []);

  const reiniciar = useCallback(() => {
    refFotos.current = {};
    siguienteId.current = -1;
    setFotosPorColor({});
  }, []);

  const galeria = useMemo<GaleriaPrenda>(
    () => ({
      codProducto: 0,
      maxFotosPorColor: MAX_FOTOS_POR_COLOR_BORRADOR,
      colores: Object.entries(fotosPorColor)
        .filter(([, fotos]) => fotos.length > 0)
        .map(([cod, fotos]) => {
          const c = catalogoColores.find((x) => x.codColor === Number(cod));
          return {
            codColor: Number(cod),
            nombreColor: c?.nombreColor ?? 'Color',
            codigoHex: c?.codigoHex ?? '#111827',
            talles: [],
            fotos,
          };
        }),
    }),
    [fotosPorColor, catalogoColores]
  );

  const acciones = useMemo<AccionesGaleria>(
    () => ({
      modo: 'borrador',
      agregar: async (codColor, imagen) => {
        const actuales = refFotos.current[codColor] ?? [];
        if (actuales.length >= MAX_FOTOS_POR_COLOR_BORRADOR) {
          throw new Error(`Cada color admite hasta ${MAX_FOTOS_POR_COLOR_BORRADOR} fotos.`);
        }
        const foto = { idFoto: siguienteId.current--, url: imagen };
        actualizar((prev) => ({ ...prev, [codColor]: [...(prev[codColor] ?? []), foto] }));
      },
      eliminar: async (codColor, idFoto) => {
        actualizar((prev) => ({
          ...prev,
          [codColor]: (prev[codColor] ?? []).filter((f) => f.idFoto !== idFoto),
        }));
      },
      ordenar: async (codColor, orden) => {
        actualizar((prev) => {
          const fotos = prev[codColor] ?? [];
          const ordenadas = orden
            .map((id) => fotos.find((f) => f.idFoto === id))
            .filter((f): f is FotoColor => Boolean(f));
          return { ...prev, [codColor]: ordenadas };
        });
      },
    }),
    [actualizar]
  );

  return { galeria, acciones, reiniciar, fotosPorColor };
}

/**
 * Sube las fotos del borrador a la prenda recién creada, de a una (límite de 4,5 MB por
 * petición de Vercel) y en orden: la primera de cada color queda como portada.
 * Solo se suben los colores que tienen talles en la prenda.
 */
export async function subirFotosBorrador(
  codProducto: number,
  fotosPorColor: Record<number, FotoColor[]>,
  coloresConTalles: Set<number>,
  onProgreso?: (actual: number, total: number) => void
): Promise<{ subidas: number; fallidas: number; error: string | null }> {
  const cola = Object.entries(fotosPorColor)
    .filter(([cod]) => coloresConTalles.has(Number(cod)))
    .flatMap(([cod, fotos]) => fotos.map((f) => ({ codColor: Number(cod), imagen: f.url })));
  const servidor = accionesGaleriaServidor(codProducto);
  let subidas = 0;
  let error: string | null = null;
  for (let i = 0; i < cola.length; i++) {
    onProgreso?.(i + 1, cola.length);
    try {
      await servidor.agregar(cola[i].codColor, cola[i].imagen);
      subidas++;
    } catch (e) {
      error = e instanceof Error ? e.message : 'No se pudo subir una foto.';
    }
  }
  return { subidas, fallidas: cola.length - subidas, error };
}
