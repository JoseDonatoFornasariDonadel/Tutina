'use client';

/* eslint-disable @next/next/no-img-element */
import { LOGO_CLARO_POR_DEFECTO, LOGO_OSCURO_POR_DEFECTO, resolverLogos } from '@/lib/logos';

interface LogoDualProps {
  logoUrl?: string | null;
  logoDarkUrl?: string | null;
  alt: string;
  className?: string;
}

/**
 * Muestra el logo de modo claro o el de modo oscuro según la clase "dark" de <html>.
 * Los dos se renderizan y el CSS muestra uno solo, así el cambio de tema es instantáneo.
 */
export function LogoDual({ logoUrl, logoDarkUrl, alt, className = '' }: LogoDualProps) {
  const { claro, oscuro } = resolverLogos(logoUrl, logoDarkUrl);
  return (
    <>
      <img
        src={claro}
        alt={alt}
        className={`dark:hidden ${className}`}
        onError={(e) => {
          if (!e.currentTarget.src.endsWith(LOGO_CLARO_POR_DEFECTO)) {
            e.currentTarget.src = LOGO_CLARO_POR_DEFECTO;
          }
        }}
      />
      <img
        src={oscuro}
        alt={alt}
        className={`hidden dark:block ${className}`}
        onError={(e) => {
          if (!e.currentTarget.src.endsWith(LOGO_OSCURO_POR_DEFECTO)) {
            e.currentTarget.src = LOGO_OSCURO_POR_DEFECTO;
          }
        }}
      />
    </>
  );
}
