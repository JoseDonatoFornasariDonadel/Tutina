// Compresión de fotos en el navegador antes de guardarlas.
// Las fotos de celular (2–3 MB, ~4000 px) se reducen a un tamaño que sigue siendo
// mayor que el más grande que muestra la tienda, así el cliente no nota diferencia.

export interface OpcionesCompresion {
  /** Lado más largo en píxeles. */
  maxLado?: number;
  /** Calidad de 0 a 1 para WebP/JPEG. */
  calidad?: number;
}

const MAX_LADO_DEFAULT = 2000;
const CALIDAD_DEFAULT = 0.85;

function leerComoDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function cargarImagen(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // 'from-image' respeta la rotación EXIF de las fotos de celular
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Algunos navegadores no soportan el formato: se intenta con <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function tieneTransparencia(ctx: CanvasRenderingContext2D, ancho: number, alto: number): boolean {
  const { data } = ctx.getImageData(0, 0, ancho, alto);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

/**
 * Devuelve la imagen como data URL, achicada y comprimida.
 * Si no conviene comprimirla (SVG, GIF animado, imagen ya liviana o error del
 * navegador), devuelve el archivo original sin cambios.
 */
export async function comprimirImagen(
  file: File,
  { maxLado = MAX_LADO_DEFAULT, calidad = CALIDAD_DEFAULT }: OpcionesCompresion = {}
): Promise<string> {
  const original = () => leerComoDataUrl(file);

  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return original();
  }

  try {
    const imagen = await cargarImagen(file);
    const anchoOrig = imagen.width;
    const altoOrig = imagen.height;
    const escala = Math.min(1, maxLado / Math.max(anchoOrig, altoOrig));
    const ancho = Math.max(1, Math.round(anchoOrig * escala));
    const alto = Math.max(1, Math.round(altoOrig * escala));

    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imagen, 0, 0, ancho, alto);

    // WebP conserva la transparencia; si el navegador no puede generar WebP
    // (devuelve PNG), se usa JPEG, salvo que la imagen tenga transparencia.
    let resultado = canvas.toDataURL('image/webp', calidad);
    if (!resultado.startsWith('data:image/webp')) {
      const puedeTenerAlfa = file.type === 'image/png' || file.type === 'image/webp';
      resultado =
        puedeTenerAlfa && tieneTransparencia(ctx, ancho, alto)
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', calidad);
    }
    // Se libera recién ahora: Chrome dibuja en diferido y cerrar la imagen antes de
    // exportar deja el canvas vacío.
    if ('close' in imagen) imagen.close();

    // Un resultado vacío ("data:,") significa que el navegador no pudo exportar
    if (!/^data:image\/[a-z+]+;base64,./.test(resultado)) {
      return original();
    }

    // Si la "comprimida" pesa más que el original (imágenes chicas), se usa el original
    const tamanoResultado = Math.ceil((resultado.length - resultado.indexOf(',') - 1) * 0.75);
    if (tamanoResultado >= file.size && escala === 1) {
      return original();
    }
    return resultado;
  } catch {
    return original();
  }
}
