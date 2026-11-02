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

export async function generarTokenSesionAdmin(usuario: string): Promise<string> {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 días
  const payload = `${usuario.toLowerCase()}.${exp}`;
  const firma = await hmacSha256Hex(payload, getSecret());
  return `${payload}.${firma}`;
}

export async function verificarTokenSesionAdmin(token?: string | null): Promise<boolean> {
  if (!token) return false;
  const partes = token.split('.');
  if (partes.length !== 3) return false;

  const [usuario, expStr, firmaRecibida] = partes;
  const exp = Number(expStr);
  if (!usuario || Number.isNaN(exp) || Date.now() > exp) {
    return false;
  }

  const payload = `${usuario}.${expStr}`;
  let firmaEsperada: string;
  try {
    firmaEsperada = await hmacSha256Hex(payload, getSecret());
  } catch {
    return false;
  }
  return compararSeguro(firmaRecibida, firmaEsperada);
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
