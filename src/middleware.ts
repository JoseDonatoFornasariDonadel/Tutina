import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, verificarTokenSesionAdmin } from '@/lib/auth';

const RUTAS_PAGINAS_PRIVADAS = [
  '/catalogo',
  '/pedidos',
  '/clientes',
  '/proveedores',
  '/reportes',
  '/alertas',
  '/configuracion',
];

const RUTAS_API_PRIVADAS = [
  '/api/catalogo',
  '/api/pedidos',
  '/api/clientes',
  '/api/proveedores',
  '/api/reportes',
  '/api/alertas',
  '/api/configuracion',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const esApiPrivada = RUTAS_API_PRIVADAS.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`)
  );
  const esPaginaPrivada = RUTAS_PAGINAS_PRIVADAS.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`)
  );
  const esLogin = pathname === '/login';

  if (!esApiPrivada && !esPaginaPrivada && !esLogin) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const sesionValida = await verificarTokenSesionAdmin(token);

  // Si ya tiene sesión activa e intenta ir a /login, lo llevamos directo al panel de gestión
  if (esLogin && sesionValida) {
    return NextResponse.redirect(new URL('/catalogo', request.url));
  }

  // Si intenta llamar a una API de gestión sin sesión de administradora -> Bloqueo 401 inmediato
  if (esApiPrivada && !sesionValida) {
    return NextResponse.json(
      { error: 'No autorizado. Este recurso es exclusivo del panel de gestión de Tutina.' },
      { status: 401 }
    );
  }

  // Si intenta abrir una pantalla de gestión sin sesión -> Redirección a /login
  if (esPaginaPrivada && !sesionValida) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/catalogo/:path*',
    '/pedidos/:path*',
    '/clientes/:path*',
    '/proveedores/:path*',
    '/reportes/:path*',
    '/alertas/:path*',
    '/configuracion/:path*',
    '/login',
    '/api/catalogo/:path*',
    '/api/pedidos/:path*',
    '/api/clientes/:path*',
    '/api/proveedores/:path*',
    '/api/reportes/:path*',
    '/api/alertas/:path*',
    '/api/configuracion/:path*',
  ],
};
