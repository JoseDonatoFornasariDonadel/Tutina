import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Límite de intentos de inicio de sesión del panel.
 * Después de MAX_FALLOS contraseñas incorrectas desde la misma conexión en VENTANA_MS,
 * el acceso desde esa conexión se bloquea hasta que el fallo más viejo de la ventana vence.
 *
 * Los intentos se guardan en la base (tabla IntentoAccesoAdmin) porque en Vercel cada
 * petición puede atenderla un servidor distinto: un contador en memoria no serviría.
 */
export const MAX_FALLOS = 5;
export const VENTANA_MS = 15 * 60 * 1000;
// Los registros viejos se borran solos
const CONSERVAR_MS = 24 * 60 * 60 * 1000;

/**
 * Regla pura (sin base de datos): con las fechas de los fallos recientes, dice si la
 * conexión está bloqueada y cuántos segundos faltan.
 */
export function evaluarBloqueo(
  fallos: Date[],
  ahora: number = Date.now()
): { bloqueado: boolean; segundosRestantes: number } {
  const enVentana = fallos
    .map((f) => f.getTime())
    .filter((t) => ahora - t < VENTANA_MS)
    .sort((a, b) => b - a);
  if (enVentana.length < MAX_FALLOS) return { bloqueado: false, segundosRestantes: 0 };
  // Se desbloquea cuando el MAX_FALLOS-ésimo fallo más reciente sale de la ventana
  const desbloqueo = enVentana[MAX_FALLOS - 1] + VENTANA_MS;
  return { bloqueado: true, segundosRestantes: Math.max(1, Math.ceil((desbloqueo - ahora) / 1000)) };
}

/** IP de quien intenta entrar (Vercel la informa en x-forwarded-for). */
export function obtenerIp(headers: Headers): string {
  const reenviada = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return reenviada || headers.get('x-real-ip')?.trim() || 'desconocida';
}

/** Huella de la IP: sirve para contar intentos sin guardar la IP real. */
export function claveDeIp(ip: string): string {
  const sal = process.env.TUTINA_SESSION_SECRET || 'tutina';
  return createHash('sha256').update(`${sal}:${ip}`).digest('hex').slice(0, 32);
}

function faltaTabla(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2021' || error.code === 'P2022')
  );
}

/**
 * ¿Está bloqueada esta conexión? Si la tabla todavía no existe (falta `db:push`),
 * no bloquea: nunca deja a la dueña afuera de su propio panel por eso.
 */
export async function consultarBloqueo(clave: string, ahora: number = Date.now()) {
  try {
    const fallos = await prisma.intentoAccesoAdmin.findMany({
      where: { clave, exitoso: false, fecha: { gte: new Date(ahora - VENTANA_MS) } },
      select: { fecha: true },
      orderBy: { fecha: 'desc' },
      take: MAX_FALLOS,
    });
    return evaluarBloqueo(
      fallos.map((f) => f.fecha),
      ahora
    );
  } catch (error) {
    if (faltaTabla(error)) {
      console.warn('Límite de intentos desactivado: falta crear la tabla IntentoAccesoAdmin (npm run db:push).');
      return { bloqueado: false, segundosRestantes: 0 };
    }
    throw error;
  }
}

/** Anota un intento. Un acceso correcto borra los fallos anteriores de esa conexión. */
export async function registrarIntento(clave: string, exitoso: boolean) {
  try {
    if (exitoso) {
      await prisma.intentoAccesoAdmin.deleteMany({ where: { clave, exitoso: false } });
    } else {
      await prisma.intentoAccesoAdmin.create({ data: { clave, exitoso: false } });
    }
    // Limpieza de registros viejos
    await prisma.intentoAccesoAdmin.deleteMany({
      where: { fecha: { lt: new Date(Date.now() - CONSERVAR_MS) } },
    });
  } catch (error) {
    if (!faltaTabla(error)) throw error;
  }
}

/** Texto para mostrar cuánto falta para volver a intentar. */
export function textoEspera(segundos: number): string {
  const minutos = Math.ceil(segundos / 60);
  return minutos <= 1 ? 'un minuto' : `${minutos} minutos`;
}
