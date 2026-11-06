'use client';

import { useCallback, useEffect, useState } from 'react';

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
