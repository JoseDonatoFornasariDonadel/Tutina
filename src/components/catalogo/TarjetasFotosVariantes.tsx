'use client';

import React from 'react';
import {
  AlertTriangle,
  Camera,
  ChevronRight,
  Image as ImageIcon,
  Images,
  Layers,
} from 'lucide-react';
import { ImagenProducto } from '@/components/tienda/ImagenProducto';
import { mapearTextoAColorHex } from '@/lib/colores';
import type { GaleriaPrenda } from '@/components/catalogo/galeriaPrenda';
import type { ColorDeLaPrenda } from '@/components/catalogo/GestionFotosSheet';
import type { VarianteEditable } from '@/components/catalogo/GestionVariantesSheet';

const STOCK_CRITICO = 3;

/**
 * Agrupa las variantes por color con sus talles (S, M, L). Todos los talles de un color
 * comparten las mismas fotos. Sirve tanto para una prenda guardada como para una nueva.
 */
export function agruparColoresDeVariantes(
  variantes: VarianteEditable[],
  colores: { codColor: number; nombreColor: string; codigoHex: string }[],
  talles: { codTalle: number; nombreTalle: string }[]
): ColorDeLaPrenda[] {
  const mapa = new Map<number, ColorDeLaPrenda>();
  for (const v of variantes) {
    const cod = v.codColor ?? v.color?.codColor;
    if (cod === undefined) continue;
    const c = colores.find((x) => x.codColor === cod) ??
      v.color ?? { codColor: cod, nombreColor: 'Color', codigoHex: '#111827' };
    const item = mapa.get(cod) ?? { ...c, codColor: cod, talles: [] };
    const nombreTalle =
      talles.find((t) => t.codTalle === (v.codTalle ?? v.talle?.codTalle))?.nombreTalle ??
      v.talle?.nombreTalle;
    if (nombreTalle && !item.talles.includes(nombreTalle)) item.talles.push(nombreTalle);
    mapa.set(cod, item);
  }
  return [...mapa.values()];
}

interface TarjetasFotosVariantesProps {
  /** Colores de la prenda con sus talles (agruparColoresDeVariantes) */
  colores: ColorDeLaPrenda[];
  variantes: VarianteEditable[];
  galeria: GaleriaPrenda | null;
  onGestionarFotos: () => void;
  onGestionarVariantes: () => void;
  /** Estado de la galería guardada (en una prenda nueva no aplica) */
  cargandoFotos?: boolean;
  faltaActualizarBase?: boolean;
  /** Muestra la etiqueta «Cambios sin guardar» */
  sinGuardar?: boolean;
  /** Cuenta el stock bajo (no aplica a la cantidad que ingresa con una factura) */
  avisarStockBajo?: boolean;
  /** Texto de unidades del resumen (por defecto "en stock") */
  textoUnidades?: string;
  id?: string;
  className?: string;
}

/**
 * Sección «Fotos y variantes» de una prenda: dos tarjetas-botón que abren sus paneles
 * (bottom sheet en el celular, ventana centrada en escritorio). Se usa igual en
 * «Editar prenda» y en «Nueva prenda».
 */
export function TarjetasFotosVariantes({
  colores,
  variantes,
  galeria,
  onGestionarFotos,
  onGestionarVariantes,
  cargandoFotos = false,
  faltaActualizarBase = false,
  sinGuardar = false,
  avisarStockBajo = true,
  textoUnidades = 'en stock',
  id,
  className = '',
}: TarjetasFotosVariantesProps) {
  const totalFotos = (galeria?.colores ?? []).reduce((acc, c) => acc + c.fotos.length, 0);
  const coloresConFotos = (galeria?.colores ?? []).filter((c) => c.fotos.length > 0).length;
  const stockTotal = variantes.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
  const criticas = avisarStockBajo
    ? variantes.filter((v) => Number(v.stock) < STOCK_CRITICO).length
    : 0;

  const estadoFotos =
    cargandoFotos && !galeria
      ? 'Cargando fotos…'
      : faltaActualizarBase
        ? 'Falta actualizar la base de datos'
        : totalFotos === 0
          ? 'Sin fotos todavía'
          : `${totalFotos} ${totalFotos === 1 ? 'foto' : 'fotos'} en ${coloresConFotos} ${
              coloresConFotos === 1 ? 'color' : 'colores'
            }`;

  return (
    <div id={id} className={`space-y-3 ${className}`}>
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
        <Images className="w-4 h-4 text-slate-500" /> Fotos y variantes
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Gestionar fotos */}
        <button
          type="button"
          onClick={onGestionarFotos}
          className="group text-left p-4 rounded-2xl border border-slate-200 bg-white hover:border-rose-300 hover:shadow-md active:scale-[0.99] transition cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Camera className="w-6 h-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-base font-extrabold text-slate-900">Gestionar fotos</div>
              <div className="text-xs text-slate-500">{estadoFotos}</div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-rose-600 transition shrink-0" />
          </div>
          {/* Portada de cada color */}
          <div className="mt-3 flex gap-2 overflow-hidden">
            {colores.slice(0, 5).map((c) => {
              const fotosColor = galeria?.colores.find((g) => g.codColor === c.codColor)?.fotos ?? [];
              return (
                <span
                  key={c.codColor}
                  className="relative w-12 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0"
                  title={`${c.nombreColor}: ${fotosColor.length} foto(s)`}
                >
                  {fotosColor[0] ? (
                    <ImagenProducto
                      src={fotosColor[0].url}
                      alt=""
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <ImageIcon className="absolute inset-0 m-auto w-4 h-4 text-slate-300" />
                  )}
                  <span
                    className="absolute bottom-1 left-1 w-3 h-3 rounded-full border border-white shadow"
                    style={{ backgroundColor: mapearTextoAColorHex(c.nombreColor, c.codigoHex) }}
                  />
                  {fotosColor.length > 1 && (
                    <span className="absolute top-0.5 right-0.5 px-1 rounded bg-slate-900/75 text-white text-[9px] font-bold">
                      {fotosColor.length}
                    </span>
                  )}
                </span>
              );
            })}
            {colores.length > 5 && (
              <span className="w-12 h-14 rounded-lg bg-slate-100 text-xs font-bold text-slate-600 flex items-center justify-center shrink-0">
                +{colores.length - 5}
              </span>
            )}
          </div>
        </button>

        {/* Gestionar variantes */}
        <button
          type="button"
          onClick={onGestionarVariantes}
          className="group text-left p-4 rounded-2xl border border-slate-200 bg-white hover:border-rose-300 hover:shadow-md active:scale-[0.99] transition cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Layers className="w-6 h-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-base font-extrabold text-slate-900">Gestionar variantes</div>
              <div className="text-xs text-slate-500">
                {variantes.length} {variantes.length === 1 ? 'variante' : 'variantes'} ·{' '}
                {stockTotal} u. {textoUnidades}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-rose-600 transition shrink-0" />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {sinGuardar && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-700">
                Cambios sin guardar
              </span>
            )}
            {criticas > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-300 text-[11px] font-bold text-amber-900">
                <AlertTriangle className="w-3 h-3" /> {criticas} con stock bajo
              </span>
            )}
            {colores.slice(0, 3).map((c) => (
              <span
                key={c.codColor}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-700"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full border border-black/10 dark:border-white/40"
                  style={{ backgroundColor: mapearTextoAColorHex(c.nombreColor, c.codigoHex) }}
                />
                {c.nombreColor}: {c.talles.join(', ')}
              </span>
            ))}
            {colores.length > 3 && (
              <span className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-600">
                +{colores.length - 3} colores
              </span>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}
