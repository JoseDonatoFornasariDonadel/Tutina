/**
 * Utilidad para mapear nombres de colores en español (simples y compuestos)
 * a códigos hexadecimales aproximados de la paleta de Tailwind CSS.
 */

export function normalizarNombreColor(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const MAPA_COLORES_COMPUESTOS: [string, string][] = [
  // Verdes compuestos
  ['verde agua', '#2DD4BF'], // teal-400
  ['verde menta', '#6EE7B7'], // emerald-300
  ['verde oliva', '#65A30D'], // lime-600 / olive
  ['verde militar', '#4D7C0F'], // lime-700
  ['verde musgo', '#3F6212'], // lime-800
  ['verde esmeralda', '#10B981'], // emerald-500
  ['verde lima', '#84CC16'], // lime-500
  ['verde manzana', '#A3E635'], // lime-400
  ['verde oscuro', '#14532D'], // green-900
  ['verde ingles', '#064E3B'], // emerald-900
  ['verde claro', '#86EFAC'], // green-300
  ['verde pastel', '#A7F3D0'], // emerald-200
  ['verde seco', '#6B8E78'],

  // Azules compuestos
  ['azul marino', '#1E3A8A'], // blue-900
  ['azul francia', '#2563EB'], // blue-600
  ['azul electrico', '#1D4ED8'], // blue-700
  ['azul petroleo', '#115E59'], // teal-800
  ['azul noche', '#172554'], // blue-950
  ['azul claro', '#60A5FA'], // blue-400
  ['azul aero', '#7DD3FC'], // sky-300
  ['azul oscuro', '#1E3A8A'], // blue-900
  ['celeste pastel', '#BAE6FD'], // sky-200
  ['celeste oscuro', '#0284C7'], // sky-600

  // Rosas / Rojos / Violetas compuestos
  ['rosa viejo', '#D48C96'],
  ['rosa bebe', '#FBCFE8'], // pink-200
  ['rosa pastel', '#F9A8D4'], // pink-300
  ['rosa chicle', '#EC4899'], // pink-500
  ['rosa claro', '#FBCFE8'], // pink-200
  ['rosa Dior', '#F472B6'],
  ['rojo carmin', '#991B1B'], // red-800
  ['rojo oscuro', '#7F1D1D'], // red-900
  ['rojo fuego', '#DC2626'], // red-600

  // Grises / Neutros compuestos
  ['gris melange', '#9CA3AF'], // gray-400
  ['gris claro', '#D1D5DB'], // gray-300
  ['gris oscuro', '#374151'], // gray-700
  ['gris topo', '#6B7280'], // gray-500
  ['gris perla', '#E5E7EB'], // gray-200
  ['gris plomo', '#4B5563'], // gray-600
  ['blanco tiza', '#F8FAFC'], // slate-50
  ['blanco roto', '#F5F5F4'], // stone-100
  ['off white', '#FAF8F5'],
  ['marron claro', '#A16207'],
  ['marron oscuro', '#451A03'],
];

const MAPA_COLORES_BASE: Record<string, string> = {
  negro: '#111827', // gray-900
  black: '#111827',
  blanco: '#FFFFFF',
  white: '#FFFFFF',
  crudo: '#F5F5DC',
  crema: '#FEF3C7',
  manteca: '#FEF9C3',
  marfil: '#FFFFF0',
  tiza: '#F8FAFC',
  natural: '#F5F5F4',

  gris: '#6B7280', // gray-500
  melange: '#9CA3AF', // gray-400
  grafito: '#374151', // gray-700
  plomo: '#4B5563',
  plata: '#C0C0C0',
  plateado: '#CBD5E1',

  rojo: '#EF4444', // red-500
  carmin: '#B91C1C',
  bordo: '#7F1D1D', // red-900
  borgona: '#7F1D1D',
  vino: '#881337', // rose-900
  terracota: '#C2410C', // orange-700
  ladrillo: '#9A3412',

  rosa: '#F472B6', // pink-400
  rosado: '#F472B6',
  fucsia: '#D946EF', // fuchsia-500
  magenta: '#DB2777', // pink-600
  coral: '#FB7185', // rose-400
  salmon: '#FDA4AF', // rose-300
  durazno: '#FDBA74', // orange-300

  naranja: '#F97316', // orange-500
  mandarina: '#FB923C',

  amarillo: '#EAB308', // yellow-500
  mostaza: '#CA8A04', // yellow-600
  oro: '#D4AF37',
  dorado: '#EAB308',
  limon: '#FACC15',

  verde: '#22C55E', // green-500
  agua: '#2DD4BF', // teal-400
  menta: '#6EE7B7', // emerald-300
  esmeralda: '#10B981', // emerald-500
  oliva: '#65A30D', // lime-600
  militar: '#4D7C0F', // lime-700
  lima: '#84CC16', // lime-500
  musgo: '#3F6212',
  pistacho: '#A3E635',

  turquesa: '#06B6D4', // cyan-500
  aguamarina: '#2DD4BF', // teal-400
  cian: '#06B6D4',
  aqua: '#22D3EE',
  petroleo: '#115E59', // teal-800

  celeste: '#38BDF8', // sky-400
  cielo: '#7DD3FC',
  azul: '#2563EB', // blue-600
  marino: '#1E3A8A', // blue-900
  indigo: '#4F46E5', // indigo-600
  jean: '#3B82F6',
  denim: '#1D4ED8',

  violeta: '#8B5CF6', // violet-500
  morado: '#7C3AED', // violet-600
  purpura: '#9333EA', // purple-600
  lila: '#C084FC', // purple-400
  lavanda: '#DDD6FE', // violet-200
  ciruela: '#581C87', // purple-900
  berenjena: '#4C1D95',

  marron: '#78350F', // amber-900
  chocolate: '#451A03', // amber-950
  cafe: '#713F12',
  camel: '#C19A6B',
  suela: '#B45309', // amber-700
  tostado: '#92400E', // amber-800
  habano: '#854D0E',
  arena: '#D6C7B2',
  beige: '#D6C7B2',
  nude: '#E5C2B3',
  vison: '#A89F91',
  caqui: '#BDB76B',
  khaki: '#BDB76B',
};

/**
 * Infiere un código hexadecimal a partir del texto ingresado por el usuario.
 * Si no encuentra coincidencia directa ni parcial, retorna null.
 */
export function inferirHexDesdeTexto(nombreColor: string): string | null {
  const norm = normalizarNombreColor(nombreColor);
  if (!norm) return null;

  // Si el usuario ingresó un código hex directamente
  if (/^#[0-9a-f]{6}$/i.test(norm)) {
    return norm.toUpperCase();
  }

  // 1. Coincidencia exacta en compuestos o base
  for (const [frase, hex] of MAPA_COLORES_COMPUESTOS) {
    if (norm === frase) return hex;
  }
  if (MAPA_COLORES_BASE[norm]) {
    return MAPA_COLORES_BASE[norm];
  }

  // 2. Coincidencia por frase compuesta contenida en el texto
  for (const [frase, hex] of MAPA_COLORES_COMPUESTOS) {
    if (norm.includes(frase)) return hex;
  }

  // 3. Coincidencia por palabras individuales
  const palabras = norm.split(/[\s\-_/]+/);
  for (const palabra of palabras) {
    if (MAPA_COLORES_BASE[palabra]) {
      return MAPA_COLORES_BASE[palabra];
    }
  }

  // 4. Coincidencia por prefijo / inclusión en colores base
  for (const [clave, hex] of Object.entries(MAPA_COLORES_BASE)) {
    if (clave.length >= 4 && norm.includes(clave)) {
      return hex;
    }
  }

  return null;
}

/**
 * Devuelve el código hexadecimal para renderizar el círculo indicador de color.
 * Prioriza el mapeo inteligente por nombre cuando el hex guardado es el fallback por defecto (#111827)
 * y el color no es negro, o cuando no se provee un hex válido.
 */
export function mapearTextoAColorHex(
  nombreColor: string,
  hexExistente?: string | null
): string {
  const inferido = inferirHexDesdeTexto(nombreColor);
  const norm = normalizarNombreColor(nombreColor);
  const esNegroExplicito =
    norm.includes('negro') || norm.includes('black') || norm.includes('oscuro');

  const hexLimpio = (hexExistente || '').trim();
  const tieneHexValido = /^#[0-9a-fA-F]{6}$/.test(hexLimpio);
  const esHexDefault =
    hexLimpio.toUpperCase() === '#111827' || hexLimpio.toUpperCase() === '#000000';

  if (tieneHexValido && (!esHexDefault || esNegroExplicito)) {
    return hexLimpio;
  }

  if (inferido) {
    return inferido;
  }

  if (tieneHexValido) {
    return hexLimpio;
  }

  return '#111827';
}
