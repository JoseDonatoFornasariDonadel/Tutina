export const ADMIN_COOKIE_NAME = 'tutina_admin_session';

function getSecret(): string {
  const secret = process.env.TUTINA_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'Falta la variable de entorno TUTINA_SESSION_SECRET (mínimo 32 caracteres).'
    );
  }
  return secret;
}

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const DURACION_SESION_MS = 1000 * 60 * 60 * 24 * 7; // 7 días

/**
 * Huella corta de la contraseña vigente. Va dentro de la sesión: si se cambia
 * TUTINA_ADMIN_PASSWORD, todas las sesiones abiertas dejan de valer.
 */
async function huellaContrasena(): Promise<string> {
  const password = (process.env.TUTINA_ADMIN_PASSWORD || '').trim();
  return (await hmacSha256Hex(`clave:${password}`, getSecret())).slice(0, 16);
}

export async function generarTokenSesionAdmin(
  usuario: string,
  ahora: number = Date.now()
): Promise<string> {
  const exp = ahora + DURACION_SESION_MS;
  // El usuario no puede contener puntos (son el separador del token)
  const nombre = usuario.toLowerCase().replace(/\./g, '_');
  const payload = `${nombre}.${exp}.${await huellaContrasena()}`;
  const firma = await hmacSha256Hex(payload, getSecret());
  return `${payload}.${firma}`;
}

export async function verificarTokenSesionAdmin(token?: string | null): Promise<boolean> {
  if (!token) return false;
  const partes = token.split('.');
  if (partes.length !== 4) return false;

  const [usuario, expStr, huella, firmaRecibida] = partes;
  const exp = Number(expStr);
  if (!usuario || Number.isNaN(exp) || Date.now() > exp) {
    return false;
  }

  const payload = `${usuario}.${expStr}.${huella}`;
  try {
    const [firmaEsperada, huellaActual] = await Promise.all([
      hmacSha256Hex(payload, getSecret()),
      huellaContrasena(),
    ]);
    // Firma válida y emitida con la contraseña vigente
    return compararSeguro(firmaRecibida, firmaEsperada) && compararSeguro(huella, huellaActual);
  } catch {
    return false;
  }
}

// Comparación en tiempo constante para no filtrar información por tiempos de respuesta
export function compararSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
