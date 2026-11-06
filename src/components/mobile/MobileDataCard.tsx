'use client';

import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface DatoTarjeta {
  label: string;
  valor: React.ReactNode;
}

interface MobileDataCardProps {
  /** Dato principal de la fila (nombre de prenda, nro. de factura...) */
  titulo: React.ReactNode;
  /** Línea secundaria corta: proveedor, fecha, variante */
  subtitulo?: React.ReactNode;
  /** Etiqueta a la izquierda del título (código, estado) */
  etiqueta?: React.ReactNode;
  /** Valor destacado a la derecha: total, stock, precio */
  valor?: React.ReactNode;
  /** Texto chico bajo el valor (ej. "IVA 21%") */
  valorDetalle?: React.ReactNode;
  /** 2-4 datos que se ven siempre, en grilla de dos columnas */
  datos?: DatoTarjeta[];
  /** Detalle que se muestra al tocar la tarjeta */
  children?: React.ReactNode;
  /** Botones de acción, visibles al expandir */
  acciones?: React.ReactNode;
  /** Resalta la tarjeta (ej. stock crítico) */
  tono?: 'normal' | 'alerta' | 'peligro';
  abiertaPorDefecto?: boolean;
}

const BORDE_POR_TONO = {
  normal: 'border-slate-200',
  alerta: 'border-amber-300',
  peligro: 'border-rose-300',
};

/**
 * Reemplazo móvil de una fila de tabla: muestra lo esencial y esconde
 * el detalle detrás de un toque. Toda la cabecera es el área táctil (≥ 56px).
 */
export function MobileDataCard({
  titulo,
  subtitulo,
  etiqueta,
  valor,
  valorDetalle,
  datos,
  children,
  acciones,
  tono = 'normal',
  abiertaPorDefecto = false,
}: MobileDataCardProps) {
  const [abierta, setAbierta] = useState(abiertaPorDefecto);
  const idDetalle = useId();
  const expandible = Boolean(children || acciones);

  const cabecera = (
    <>
      <div className="min-w-0 flex-1">
        {etiqueta && <div className="mb-1 flex">{etiqueta}</div>}
        <div className="text-[15px] font-bold text-slate-900 truncate">{titulo}</div>
        {subtitulo && <div className="text-xs text-slate-500 mt-0.5 truncate">{subtitulo}</div>}
      </div>
      {(valor || valorDetalle) && (
        <div className="text-right shrink-0">
          {valor && <div className="text-[15px] font-extrabold text-slate-900">{valor}</div>}
          {valorDetalle && <div className="text-[11px] text-slate-400">{valorDetalle}</div>}
        </div>
      )}
      {expandible && (
        <ChevronDown
          aria-hidden="true"
          className={`w-5 h-5 shrink-0 text-slate-400 transition-transform duration-200 ${
            abierta ? 'rotate-180' : ''
          }`}
        />
      )}
    </>
  );

  return (
    <div className={`rounded-2xl border bg-white overflow-hidden ${BORDE_POR_TONO[tono]}`}>
      {expandible ? (
        <button
          type="button"
          onClick={() => setAbierta((v) => !v)}
          aria-expanded={abierta}
          aria-controls={idDetalle}
          className="w-full min-h-14 px-4 py-3 flex items-center gap-3 text-left active:bg-slate-50 cursor-pointer"
        >
          {cabecera}
        </button>
      ) : (
        <div className="min-h-14 px-4 py-3 flex items-center gap-3">{cabecera}</div>
      )}

      {datos && datos.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 pb-3 -mt-1">
          {datos.map((d) => (
            <div key={d.label} className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {d.label}
              </dt>
              <dd className="text-sm font-semibold text-slate-800 truncate">{d.valor}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* El grid 0fr → 1fr anima la altura sin medir el contenido */}
      {expandible && (
        <div
          id={idDetalle}
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${
            abierta ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="overflow-hidden" inert={!abierta}>
            <div className="border-t border-slate-100 px-4 py-3 space-y-3 text-sm text-slate-700">
              {children}
              {acciones && <div className="flex flex-wrap gap-2 pt-1">{acciones}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
