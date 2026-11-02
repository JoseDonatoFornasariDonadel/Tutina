'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShoppingBag,
  PlusCircle,
  ClipboardList,
  Users,
  Truck,
  BarChart3,
  MessageSquareWarning,
  Settings,
  Sparkles,
  Phone,
  AlertTriangle,
  Moon,
  Sun,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

export interface TiendaConfig {
  idConfiguracion: number;
  nombreComercial: string;
  logoUrl: string;
  slogan: string;
  telefonoWhatsAppNotificaciones: string;
  whatsappWebhookUrl?: string | null;
  whatsappApiToken?: string | null;
  cuit?: string | null;
  direccionComercial?: string | null;
  instagramHandle?: string | null;
  markupPorDefectoGlobal: number;
  umbralAlertaStockDefault: number;
  diasToleranciaPendientePago: number;
  alertaPagoContarDesde: 'FECHA_PEDIDO' | 'CAMBIO_ESTADO';
}

interface AppContextType {
  config: TiendaConfig;
  alertasCriticasCount: number;
  darkMode: boolean;
  toggleDarkMode: () => void;
  refreshGlobalState: () => Promise<void>;
}

const defaultConfig: TiendaConfig = {
  idConfiguracion: 1,
  nombreComercial: 'Tutina',
  logoUrl: '/tutina-logo.svg',
  slogan: 'Indumentaria Deportiva & Urbana',
  telefonoWhatsAppNotificaciones: '+5493516543210',
  markupPorDefectoGlobal: 120,
  umbralAlertaStockDefault: 3,
  diasToleranciaPendientePago: 5,
  alertaPagoContarDesde: 'FECHA_PEDIDO',
};

const AppContext = createContext<AppContextType>({
  config: defaultConfig,
  alertasCriticasCount: 0,
  darkMode: false,
  toggleDarkMode: () => {},
  refreshGlobalState: async () => {},
});

export function useAppConfig() {
  return useContext(AppContext);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [config, setConfig] = useState<TiendaConfig>(defaultConfig);
  const [alertasCriticasCount, setAlertasCriticasCount] = useState<number>(0);
  const [pedidosVencidosCount, setPedidosVencidosCount] = useState<number>(0);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState<boolean>(false);

  useEffect(() => {
    setMenuMovilAbierto(false);
  }, [pathname]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('tutina_dark_mode');
    if (savedTheme === 'true') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('tutina_dark_mode', 'true');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('tutina_dark_mode', 'false');
      }
      return next;
    });
  }, []);

  const isPublicStorefront = pathname?.startsWith('/tienda') || pathname?.startsWith('/login');

  const cerrarSesionAdmin = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/tienda');
    router.refresh();
  };

  const refreshGlobalState = useCallback(async () => {
    try {
      if (isPublicStorefront) return;
      const [cfgRes, alRes] = await Promise.all([
        fetch('/api/configuracion', { cache: 'no-store' }),
        fetch('/api/alertas', { cache: 'no-store' }),
      ]);
      if (cfgRes.ok) {
        const cfgData = await cfgRes.json();
        setConfig(cfgData);
      }
      if (alRes.ok) {
        const alData = await alRes.json();
        const stockCount = alData.variantesCriticas?.length ?? 0;
        const vencidosCount = alData.pedidosPendientesVencidos?.length ?? 0;
        setAlertasCriticasCount(stockCount);
        setPedidosVencidosCount(vencidosCount);
      }
    } catch {
      // Silencioso en caso de carga inicial
    }
  }, [isPublicStorefront]);

  useEffect(() => {
    refreshGlobalState();
  }, [refreshGlobalState, pathname]);

  const navItems = [
    {
      href: '/catalogo',
      label: 'Catálogo & Costos',
      icon: ShoppingBag,
      desc: 'Prendas, Markup y Descuentos',
    },
    {
      href: '/pedidos/nuevo',
      label: 'Registrar Pedido',
      icon: PlusCircle,
      desc: 'Alta rápida + Modal Carrito',
      highlight: true,
    },
    {
      href: '/pedidos',
      label: 'Historial de Pedidos',
      icon: ClipboardList,
      desc: 'Estados, Pagos y Devoluciones',
    },
    {
      href: '/clientes',
      label: 'Clientes',
      icon: Users,
      desc: 'Directorio e Historial de Compras',
    },
    {
      href: '/proveedores',
      label: 'Proveedores & Facturas',
      icon: Truck,
      desc: 'Alta Proveedores e Ingresos',
    },
    {
      href: '/reportes',
      label: 'Reportes Financieros',
      icon: BarChart3,
      desc: 'Global Negocio & Por Prenda',
    },
    {
      href: '/alertas',
      label: 'Alertas WhatsApp',
      icon: MessageSquareWarning,
      desc: `Stock < ${config.umbralAlertaStockDefault} y Cobros +${config.diasToleranciaPendientePago} días`,
      badge: alertasCriticasCount + pedidosVencidosCount,
    },
    {
      href: '/configuracion',
      label: 'Identidad & Config',
      icon: Settings,
      desc: 'Logo dinámico y parámetros',
    },
    {
      href: '/tienda',
      label: 'Vidriera Web (Clientes)',
      icon: Sparkles,
      desc: 'Catálogo público + WhatsApp',
    },
  ];

  if (isPublicStorefront) {
    return (
      <AppContext.Provider
        value={{ config, alertasCriticasCount, darkMode, toggleDarkMode, refreshGlobalState }}
      >
        <div className="min-h-screen bg-slate-50 transition-colors duration-200">{children}</div>
      </AppContext.Provider>
    );
  }

  const totalAlertasActivas = alertasCriticasCount + pedidosVencidosCount;
  const itemActivoActual = navItems.find(
    (it) => pathname === it.href || (it.href !== '/pedidos' && pathname?.startsWith(it.href))
  );

  const renderContenidoSidebar = (esMovil: boolean) => (
    <>
      {/* Header con Logo Dinámico de Tutina y Toggle Modo Oscuro / Cerrar */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/catalogo"
            onClick={() => esMovil && setMenuMovilAbierto(false)}
            className="block group flex-1 min-w-0"
          >
            <div className="h-14 w-full flex items-center justify-start overflow-hidden rounded-xl bg-white px-3 py-1.5 border border-slate-200 group-hover:border-rose-300 transition">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={config.logoUrl || '/tutina-logo.svg'}
                alt={config.nombreComercial}
                className={`h-10 max-h-11 w-auto object-contain ${
                  darkMode && config.logoUrl?.includes('tutina-logo')
                    ? 'brightness-110 invert hue-rotate-180'
                    : ''
                }`}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/tutina-logo.svg';
                }}
              />
            </div>
          </Link>

          {/* Botón de Modo Oscuro / Claro */}
          <button
            type="button"
            onClick={toggleDarkMode}
            title={darkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            className="h-14 w-12 rounded-xl border border-slate-200 flex flex-col items-center justify-center gap-0.5 text-slate-600 hover:border-rose-300 hover:text-rose-600 transition cursor-pointer shrink-0 bg-slate-50/70"
          >
            {darkMode ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="text-[9px] font-bold">Claro</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-600" />
                <span className="text-[9px] font-bold">Oscuro</span>
              </>
            )}
          </button>

          {esMovil && (
            <button
              type="button"
              onClick={() => setMenuMovilAbierto(false)}
              title="Cerrar menú"
              className="h-14 w-11 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:border-rose-300 transition cursor-pointer shrink-0 bg-slate-50/70"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="mt-2.5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
              {config.nombreComercial} • Gestión
            </p>
            <p className="text-xs text-slate-500 truncate max-w-[180px]">{config.slogan}</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
            <Sparkles className="w-2.5 h-2.5" /> E-Com Ready
          </span>
        </div>
      </div>

      {/* Navegación Principal */}
      <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/pedidos' && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => esMovil && setMenuMovilAbierto(false)}
              className={`nav-sidebar-item flex items-center justify-between px-3.5 py-2.5 rounded-xl border-2 transition-all ${
                isActive
                  ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                  : item.highlight
                  ? `bg-rose-50/80 text-rose-900 border-rose-200/60 ${
                      darkMode ? 'hover:border-white' : 'hover:border-rose-600'
                    }`
                  : `border-transparent text-slate-700 ${
                      darkMode ? 'hover:border-white' : 'hover:border-rose-600'
                    }`
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-5 h-5 shrink-0 ${
                    isActive
                      ? 'text-white'
                      : item.highlight
                      ? 'text-rose-600'
                      : 'text-slate-500'
                  }`}
                />
                <div className="truncate">
                  <div className="text-sm font-semibold leading-tight">{item.label}</div>
                  <div
                    className={`text-[11px] truncate ${
                      isActive ? 'text-rose-100' : 'text-slate-400'
                    }`}
                  >
                    {item.desc}
                  </div>
                </div>
              </div>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span
                  className={`ml-2 px-2 py-0.5 text-xs font-bold rounded-full ${
                    isActive
                      ? 'bg-white text-rose-600'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Pie de Sidebar: Estado de Alertas WhatsApp */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/60 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-600 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Alertas:
          </span>
          <span className="font-mono text-[11px] text-slate-700 font-semibold">
            {config.telefonoWhatsAppNotificaciones}
          </span>
        </div>
        {alertasCriticasCount > 0 && (
          <Link
            href="/alertas"
            onClick={() => esMovil && setMenuMovilAbierto(false)}
            className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900 hover:bg-amber-100 transition"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Hay <strong>{alertasCriticasCount} variantes</strong> con stock &lt;{' '}
              {config.umbralAlertaStockDefault} u.
            </span>
          </Link>
        )}
        {pedidosVencidosCount > 0 && (
          <Link
            href="/alertas"
            onClick={() => esMovil && setMenuMovilAbierto(false)}
            className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-900 hover:bg-rose-100 transition"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              Hay <strong>{pedidosVencidosCount} pedido(s)</strong> sin pagar hace {config.diasToleranciaPendientePago}+ días.
            </span>
          </Link>
        )}

        <button
          type="button"
          onClick={cerrarSesionAdmin}
          className="w-full mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:border-rose-300 hover:text-rose-600 transition cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión de Gestión
        </button>
      </div>
    </>
  );

  return (
    <AppContext.Provider
      value={{ config, alertasCriticasCount, darkMode, toggleDarkMode, refreshGlobalState }}
    >
      <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 transition-colors duration-200">
        {/* Barra Superior Compacta en Móvil con Botón de Menú Lateral Desplegable */}
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-3.5 h-16 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMenuMovilAbierto(true)}
              aria-label="Abrir menú de gestión"
              className="relative p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-700 hover:border-rose-300 hover:text-rose-600 transition cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
              {totalAlertasActivas > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-extrabold flex items-center justify-center">
                  {totalAlertasActivas}
                </span>
              )}
            </button>

            <Link href="/catalogo" className="shrink-0">
              <div className="h-10 px-2.5 py-1 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={config.logoUrl || '/tutina-logo.svg'}
                  alt={config.nombreComercial}
                  className={`h-7 max-h-7 w-auto object-contain ${
                    darkMode && config.logoUrl?.includes('tutina-logo')
                      ? 'brightness-110 invert hue-rotate-180'
                      : ''
                  }`}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/tutina-logo.svg';
                  }}
                />
              </div>
            </Link>

            {itemActivoActual && (
              <span className="text-xs font-bold text-slate-700 truncate">
                {itemActivoActual.label}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={toggleDarkMode}
            title={darkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-600 transition cursor-pointer shrink-0 bg-slate-50/70"
          >
            {darkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
          </button>
        </header>

        {/* Menú Lateral Desplegable (Drawer) para Versión Móvil */}
        {menuMovilAbierto && (
          <div
            onClick={() => setMenuMovilAbierto(false)}
            className="fixed inset-0 z-50 lg:hidden bg-slate-900/60 backdrop-blur-xs flex"
          >
            <aside
              onClick={(e) => e.stopPropagation()}
              className="w-80 max-w-[85vw] bg-white h-full border-r border-slate-200 flex flex-col shadow-2xl overflow-hidden"
            >
              {renderContenidoSidebar(true)}
            </aside>
          </div>
        )}

        {/* Sidebar Lateral Fija en Escritorio (lg+) */}
        <aside className="hidden lg:flex lg:w-72 bg-white border-r border-slate-200 flex-col shrink-0 lg:sticky lg:top-0 lg:h-screen z-30">
          {renderContenidoSidebar(false)}
        </aside>

        {/* Contenido Principal */}
        <main className="flex-1 min-w-0">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </AppContext.Provider>
  );
}
