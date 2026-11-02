import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  ADMIN_COOKIE_NAME,
  generarTokenSesionAdmin,
  verificarTokenSesionAdmin,
  compararSeguro,
} from '@/lib/auth';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const autenticado = await verificarTokenSesionAdmin(token);
  return NextResponse.json({ autenticado });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const usuarioIngresado = String(body.usuario || '').trim();
    const passwordIngresada = String(body.password || '').trim();

    const adminUserEsperado = (process.env.TUTINA_ADMIN_USER || '').trim();
    const adminPassEsperada = (process.env.TUTINA_ADMIN_PASSWORD || '').trim();
    const secretoConfigurado = (process.env.TUTINA_SESSION_SECRET || '').length >= 32;

    if (!adminUserEsperado || !adminPassEsperada || !secretoConfigurado) {
      console.error(
        'Login deshabilitado: faltan TUTINA_ADMIN_USER, TUTINA_ADMIN_PASSWORD o TUTINA_SESSION_SECRET.'
      );
      return NextResponse.json(
        { error: 'El acceso de administración no está configurado en el servidor.' },
        { status: 503 }
      );
    }

    const usuarioValido =
      usuarioIngresado.toLowerCase() === adminUserEsperado.toLowerCase();
    const passwordValida = compararSeguro(passwordIngresada, adminPassEsperada);

    if (!usuarioValido || !passwordValida) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos. Acceso exclusivo para administración.' },
        { status: 401 }
      );
    }

    const token = await generarTokenSesionAdmin(usuarioIngresado);
    const response = NextResponse.json({ ok: true, usuario: usuarioIngresado });

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 días
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Error al procesar el inicio de sesión.' }, { status: 400 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
