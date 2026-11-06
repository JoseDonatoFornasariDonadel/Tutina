'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, ClipboardList, Plus, Truck, LayoutGrid } from 'lucide-react';

interface ItemBarra {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Las 4 secciones de uso diario + el botón central "Nuevo pedido".
// El resto (clientes, reportes, configuración...) queda en el menú "Más".
const ITEMS_IZQUIERDA: ItemBarra[] = [
  { href: '/catalogo', label: 'Catálogo', icon: ShoppingBag },
  { href: '/pedidos', label: 'Pedidos', icon: ClipboardList },
];
const ITEMS_DERECHA: ItemBarra[] = [{ href: '/proveedores', label: 'Facturas', icon: Truck }];

function estaActivo(pathname: string | null, href: string) {
  if (!pathname) return false;
  // "/pedidos" no debe quedar activo cuando se está en "/pedidos/nuevo"
  if (href === '/pedidos') return pathname === '/pedidos';
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface BottomNavProps {
  /** Abre el menú completo (drawer) con el resto de secciones */
  onAbrirMas: () => void;
  /** Contador de alertas pendientes que se muestra sobre "Más" */
  alertas?: number;
}

/**
 * Barra de navegación inferior del panel de gestión (solo móvil, < lg).
 * Todos los destinos miden al menos 56px de alto y quedan en la zona del pulgar.
 * Respeta el área segura inferior del iPhone.
 */
export function BottomNav({ onAbrirMas, alertas = 0 }: BottomNavProps) {
  const pathname = usePathname();
  const nuevoActivo = pathname === '/pedidos/nuevo';

  const renderItem = (item: ItemBarra) => {
    const activo = estaActivo(pathname, item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={activo ? 'page' : undefined}
        className={`flex-1 min-h-14 flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors ${
          activo ? 'text-rose-600' : 'text-slate-500 active:text-slate-900'
        }`}
      >
        <span
          className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
            activo ? 'bg-rose-50' : ''
          }`}
        >
          <Icon className="w-5 h-5" />
        </span>
        {item.label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Navegación principal"
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
    >
      <div className="flex items-stretch px-1">
        {ITEMS_IZQUIERDA.map(renderItem)}

        {/* Acción principal: registrar pedido */}
        <div className="flex-1 flex items-center justify-center">
          <Link
            href="/pedidos/nuevo"
            aria-label="Registrar nuevo pedido"
            aria-current={nuevoActivo ? 'page' : undefined}
            className={`-mt-6 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg ring-4 ring-white transition active:scale-95 ${
              nuevoActivo ? 'bg-rose-700' : 'bg-rose-600'
            }`}
          >
            <Plus className="w-7 h-7" strokeWidth={2.5} />
          </Link>
        </div>

        {ITEMS_DERECHA.map(renderItem)}

        <button
          type="button"
          onClick={onAbrirMas}
          aria-label={alertas > 0 ? `Más opciones, ${alertas} alertas` : 'Más opciones'}
          className="relative flex-1 min-h-14 flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-slate-500 active:text-slate-900 cursor-pointer"
        >
          <span className="relative flex h-7 w-12 items-center justify-center">
            <LayoutGrid className="w-5 h-5" />
            {alertas > 0 && (
              <span className="absolute -top-1 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center">
                {alertas > 99 ? '99+' : alertas}
              </span>
            )}
          </span>
          Más
        </button>
      </div>
    </nav>
  );
}
