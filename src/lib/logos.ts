// Logos de la tienda: uno para modo claro y otro (opcional) para modo oscuro.

export const LOGO_CLARO_POR_DEFECTO = '/tutina-logo.svg';
export const LOGO_OSCURO_POR_DEFECTO = '/tutina-logo-dark.svg';

/** Estilos oficiales: cada uno tiene su versión para fondo claro y para fondo oscuro. */
export const LOGOS_PREDEFINIDOS = [
  {
    id: 'active',
    nombre: 'Tutina Active (Rosa/Violeta)',
    claro: '/tutina-logo.svg',
    oscuro: '/tutina-logo-dark.svg',
  },
  {
    id: 'boutique',
    nombre: 'Tutina Boutique (Dark/Serif)',
    claro: '/tutina-logo-alt.svg',
    oscuro: '/tutina-logo-alt-dark.svg',
  },
] as const;

/**
 * Decide qué logo mostrar en cada modo.
 * - Claro: el logo cargado, o el de Tutina por defecto.
 * - Oscuro: el logo oscuro cargado; si no hay, la versión oscura del estilo oficial
 *   elegido para modo claro; y si el logo claro es propio, el mismo logo claro.
 */
export function resolverLogos(
  logoUrl?: string | null,
  logoDarkUrl?: string | null
): { claro: string; oscuro: string } {
  const claro = logoUrl?.trim() || LOGO_CLARO_POR_DEFECTO;
  const oscuroCargado = logoDarkUrl?.trim();
  if (oscuroCargado) return { claro, oscuro: oscuroCargado };
  const predefinido = LOGOS_PREDEFINIDOS.find((l) => l.claro === claro);
  return { claro, oscuro: predefinido ? predefinido.oscuro : claro };
}
