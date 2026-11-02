'use client';

import Image, { type ImageProps } from 'next/image';
import { useEffect, useState } from 'react';

// Hosts externos habilitados en next.config.mjs (images.remotePatterns).
const HOSTS_OPTIMIZABLES = [/\.supabase\.co$/i, /^images\.unsplash\.com$/i];

export const IMAGEN_PRENDA_FALLBACK =
  'https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=800&q=80';

/**
 * Decide si Next puede optimizar la imagen. Las que no (links de otros sitios,
 * data URLs o SVG) se muestran tal cual, para que nunca se rompa una foto.
 */
function esOptimizable(src: string): boolean {
  if (!src || src.startsWith('data:') || /\.svg($|\?)/i.test(src)) return false;
  if (src.startsWith('/')) return true;
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && HOSTS_OPTIMIZABLES.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}

type ImagenProductoProps = Omit<ImageProps, 'src' | 'onError'> & {
  src: string | null | undefined;
  fallback?: string;
};

/** Envoltorio de next/image con imagen de respaldo si la foto no carga. */
export function ImagenProducto({ src, fallback = IMAGEN_PRENDA_FALLBACK, alt, ...props }: ImagenProductoProps) {
  const [srcActual, setSrcActual] = useState(src || fallback);

  useEffect(() => {
    setSrcActual(src || fallback);
  }, [src, fallback]);

  return (
    <Image
      {...props}
      alt={alt}
      src={srcActual}
      unoptimized={props.unoptimized ?? !esOptimizable(srcActual)}
      onError={() => {
        if (srcActual !== fallback) setSrcActual(fallback);
      }}
    />
  );
}
