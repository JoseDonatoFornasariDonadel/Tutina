'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ImagePlus, Minus, Plus, Trash2 } from 'lucide-react';
import { BottomSheet } from '@/components/mobile/BottomSheet';
import { GaleriaFotos } from '@/components/galeria/GaleriaFotos';
import { ImagenProducto } from '@/components/tienda/ImagenProducto';
import { ColorSelector, type ColorOpcion } from '@/components/catalogo/ColorSelector';
import { mapearTextoAColorHex } from '@/lib/colores';
import { fotosDeColor, type GaleriaPrenda } from '@/components/catalogo/galeriaPrenda';

export interface VarianteEditable {
  codVariante?: number;
  sku?: string;
  stock: number;
  imagenVariante?: string | null;
  codTalle?: number;
  codColor?: number;
  talle?: { codTalle: number; nombreTalle: string };
  color?: { codColor: number; nombreColor: string; codigoHex: string };
}

interface GestionVariantesSheetProps {
  abierto: boolean;
  onCerrar: () => void;
  nombreProducto: string;
  variantes: VarianteEditable[];
  onCambiar: (variantes: VarianteEditable[]) => void;
  /** Variantes como están guardadas, para marcar lo que cambió */
  originales: VarianteEditable[];
  talles: { codTalle: number; nombreTalle: string }[];
  colores: ColorOpcion[];
  onCrearColor: (nombreColor: string, codigoHex: string) => Promise<ColorOpcion>;
  galeria: GaleriaPrenda | null;
  /** Abre el panel de fotos en ese color */
  onGestionarFotos: (codColor: number) => void;
  /**
   * "edicion": prenda guardada (los cambios se guardan con «Guardar cambios»).
   * "creacion": prenda nueva, todavía sin ID (todo se crea al guardar la prenda).
   */
  modo?: 'edicion' | 'creacion';
  /** Texto del campo de stock (por ejemplo "Cantidad que ingresa" desde una factura) */
  etiquetaStock?: string;
  /** Marca "Stock bajo" (no aplica a la cantidad que ingresa con una factura) */
  avisarStockBajo?: boolean;
  zIndexClass?: string;
}

const STOCK_CRITICO = 3;

const codTalleDe = (v: VarianteEditable) => v.codTalle ?? v.talle?.codTalle;
const codColorDe = (v: VarianteEditable) => v.codColor ?? v.color?.codColor;

/**
 * Lista de variantes (talle + color) de la prenda, en tarjetas: miniatura de la portada del
 * color, talle, color y stock con botones − / + grandes.
 * Los cambios quedan en la edición y se guardan con «Guardar cambios».
 */
export function GestionVariantesSheet({
  abierto,
  onCerrar,
  nombreProducto,
  variantes,
  onCambiar,
  originales,
  talles,
  colores,
  onCrearColor,
  galeria,
  onGestionarFotos,
  modo = 'edicion',
  etiquetaStock = 'Stock',
  avisarStockBajo = true,
  zIndexClass,
}: GestionVariantesSheetProps) {
  const esCreacion = modo === 'creacion';
  const [filtroColor, setFiltroColor] = useState<number | 'TODOS'>('TODOS');
  const [visor, setVisor] = useState<{ codColor: number; nombre: string } | null>(null);

  useEffect(() => {
    if (abierto) setFiltroColor('TODOS');
  }, [abierto]);

  const stockOriginal = useMemo(
    () => new Map(originales.map((v) => [v.codVariante, v.stock])),
    [originales]
  );

  // Colores presentes (para filtrar cuando hay muchos talles)
  const coloresPresentes = useMemo(() => {
    const mapa = new Map<number, { codColor: number; nombreColor: string; codigoHex: string }>();
    for (const v of variantes) {
      const cod = codColorDe(v);
      const c = colores.find((x) => x.codColor === cod) ?? v.color;
      if (cod !== undefined && c) mapa.set(cod, { ...c, codColor: cod });
    }
    return [...mapa.values()];
  }, [variantes, colores]);

  // Talle + color repetidos
  const repetidas = useMemo(() => {
    const vistos = new Map<string, number>();
    for (const v of variantes) {
      const clave = `${codTalleDe(v)}-${codColorDe(v)}`;
      vistos.set(clave, (vistos.get(clave) ?? 0) + 1);
    }
    return vistos;
  }, [variantes]);

  const totalStock = variantes.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);

  const actualizar = (idx: number, cambios: Partial<VarianteEditable>) => {
    const nuevas = [...variantes];
    nuevas[idx] = { ...nuevas[idx], ...cambios };
    onCambiar(nuevas);
  };

  const agregar = () => {
    // Se propone el mismo color que la última variante y el siguiente talle libre
    const ultima = variantes[variantes.length - 1];
    const codColor =
      (filtroColor !== 'TODOS' ? filtroColor : undefined) ??
      (ultima ? codColorDe(ultima) : undefined) ??
      colores[0]?.codColor;
    const color = colores.find((c) => c.codColor === codColor) ?? colores[0];
    const usados = new Set(variantes.filter((v) => codColorDe(v) === codColor).map(codTalleDe));
    const talle = talles.find((t) => !usados.has(t.codTalle)) ?? talles[0];
    if (!talle || !color) return;
    onCambiar([
      ...variantes,
      {
        codTalle: talle.codTalle,
        codColor: color.codColor,
        stock: 0,
        imagenVariante: null,
        talle,
        color,
      },
    ]);
    // Lleva la vista a la tarjeta nueva
    requestAnimationFrame(() =>
      document
        .getElementById(`variante-${variantes.length}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    );
  };

  const fotosVisor = visor ? fotosDeColor(galeria, visor.codColor) : [];

  return (
    <BottomSheet
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Gestionar variantes"
      subtitulo={nombreProducto}
      alturaMaxima="92dvh"
      zIndexClass={zIndexClass}
      anchoEscritorio="sm:max-w-2xl"
      accesorioTitulo={
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
          {variantes.length} · {totalStock} u.
        </span>
      }
      pie={
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={agregar}
              className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-12 px-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-bold hover:bg-rose-100 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Agregar talle / color
            </button>
            <button
              type="button"
              onClick={onCerrar}
              className="min-h-12 px-6 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 cursor-pointer"
            >
              Listo
            </button>
          </div>
          <p className="text-[11px] text-slate-500 text-center">
            {esCreacion
              ? 'Las variantes se crean al tocar «Guardar prenda».'
              : 'Los cambios se guardan al tocar «Guardar cambios» en la prenda.'}
          </p>
        </div>
      }
    >
      {coloresPresentes.length > 1 && (
        <div className="scroll-chips -mx-5 px-5 scroll-px-5 flex gap-2 pb-3" role="group" aria-label="Filtrar por color">
          {[{ codColor: 'TODOS' as const, nombreColor: 'Todos', codigoHex: '' }, ...coloresPresentes].map(
            (c) => {
              const activo = filtroColor === c.codColor;
              return (
                <button
                  key={c.codColor}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => setFiltroColor(c.codColor)}
                  className={`shrink-0 inline-flex items-center gap-1.5 min-h-10 px-3 rounded-full border text-xs font-bold transition cursor-pointer ${
                    activo
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  {c.codigoHex && (
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black/10 dark:border-white/40"
                      style={{ backgroundColor: mapearTextoAColorHex(c.nombreColor, c.codigoHex) }}
                    />
                  )}
                  {c.nombreColor}
                </button>
              );
            }
          )}
        </div>
      )}

      {variantes.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          Todavía no hay variantes. Tocá «Agregar talle / color».
        </p>
      ) : (
        <ul className="space-y-2.5">
          {variantes.map((v, idx) => {
            const codColor = codColorDe(v);
            if (filtroColor !== 'TODOS' && codColor !== filtroColor) return null;
            const color = colores.find((c) => c.codColor === codColor) ?? v.color;
            const talle = talles.find((t) => t.codTalle === codTalleDe(v)) ?? v.talle;
            const fotos = fotosDeColor(galeria, codColor);
            const miniatura = fotos[0]?.url ?? v.imagenVariante ?? null;
            const esNueva = v.codVariante === undefined;
            const antes = esNueva ? undefined : stockOriginal.get(v.codVariante);
            const cambioStock = antes !== undefined && antes !== v.stock;
            const critico = avisarStockBajo && v.stock < STOCK_CRITICO;
            const repetida = (repetidas.get(`${codTalleDe(v)}-${codColor}`) ?? 0) > 1;
            const nombreColor = color?.nombreColor ?? 'Sin color';

            return (
              <li
                id={`variante-${idx}`}
                key={v.codVariante ?? `nueva-${idx}`}
                className={`animate-sheet-fondo-entrada p-3 rounded-2xl border bg-white ${
                  repetida ? 'border-amber-400' : 'border-slate-200'
                }`}
              >
                <div className="flex gap-3">
                  {/* Miniatura: portada del color. Tocarla abre sus fotos. */}
                  <button
                    type="button"
                    onClick={() =>
                      fotos.length > 0 && codColor !== undefined
                        ? setVisor({ codColor, nombre: nombreColor })
                        : codColor !== undefined && onGestionarFotos(codColor)
                    }
                    aria-label={
                      fotos.length > 0
                        ? `Ver las ${fotos.length} fotos de ${nombreColor}`
                        : `Agregar fotos de ${nombreColor}`
                    }
                    className="relative w-16 h-20 sm:w-[72px] sm:h-[90px] shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer"
                  >
                    {miniatura ? (
                      <ImagenProducto src={miniatura} alt="" fill sizes="72px" className="object-cover" />
                    ) : (
                      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-600">
                        <ImagePlus className="w-5 h-5" />
                        <span className="text-[10px] font-bold">Fotos</span>
                      </span>
                    )}
                    {fotos.length > 1 && (
                      <span className="absolute bottom-1 right-1 px-1.5 rounded-md bg-slate-900/75 text-white text-[10px] font-bold">
                        {fotos.length}
                      </span>
                    )}
                  </button>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold text-slate-900 truncate flex items-center gap-1.5">
                          <span
                            className="w-3 h-3 rounded-full border border-black/10 dark:border-white/40 shrink-0"
                            style={{
                              backgroundColor: mapearTextoAColorHex(nombreColor, color?.codigoHex),
                            }}
                          />
                          Talle {talle?.nombreTalle ?? '—'} · {nombreColor}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {esCreacion
                            ? `Variante ${idx + 1} de ${variantes.length}`
                            : esNueva
                              ? 'Nueva: se crea al guardar'
                              : v.sku}
                        </p>
                      </div>
                      {/* Una prenda nueva necesita al menos una variante */}
                      {esNueva && !(esCreacion && variantes.length <= 1) && (
                        <button
                          type="button"
                          onClick={() => onCambiar(variantes.filter((_, i) => i !== idx))}
                          aria-label={`Quitar la variante nueva talle ${talle?.nombreTalle ?? ''} ${nombreColor}`}
                          className="touch-target -mr-1.5 -mt-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <select
                        aria-label="Talle"
                        value={codTalleDe(v)}
                        onChange={(e) => {
                          const codT = Number(e.target.value);
                          actualizar(idx, {
                            codTalle: codT,
                            talle: talles.find((t) => t.codTalle === codT) ?? v.talle,
                          });
                        }}
                        className="w-full min-h-11 px-2.5 rounded-xl border border-slate-300 bg-white text-sm font-bold"
                      >
                        {talles.map((t) => (
                          <option key={t.codTalle} value={t.codTalle}>
                            Talle {t.nombreTalle}
                          </option>
                        ))}
                      </select>
                      <ColorSelector
                        colores={colores}
                        value={codColor}
                        onCrearColor={onCrearColor}
                        onChange={(cObj) => actualizar(idx, { codColor: cObj.codColor, color: cObj })}
                      />
                    </div>
                  </div>
                </div>

                {/* Stock con botones grandes y teclado numérico */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-700">{etiquetaStock}</p>
                    <p
                      className={`text-[11px] font-semibold flex items-center gap-1 ${
                        critico ? 'text-amber-700' : 'text-slate-500'
                      }`}
                    >
                      {critico && <AlertTriangle className="w-3 h-3" />}
                      {critico ? 'Stock bajo' : avisarStockBajo ? 'Disponible' : 'Unidades'}
                      {cambioStock && <span className="text-slate-500 font-medium">· antes {antes}</span>}
                    </p>
                  </div>
                  <div className="flex items-center rounded-xl border border-slate-300 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => actualizar(idx, { stock: Math.max(0, (Number(v.stock) || 0) - 1) })}
                      disabled={v.stock <= 0}
                      aria-label={`Restar una unidad, talle ${talle?.nombreTalle ?? ''} ${nombreColor}`}
                      className="w-11 h-11 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      aria-label={`Stock talle ${talle?.nombreTalle ?? ''} ${nombreColor}`}
                      value={Number.isFinite(v.stock) ? v.stock : 0}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        actualizar(idx, { stock: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
                      }
                      className="w-14 h-11 text-center text-base font-extrabold border-x border-slate-300 bg-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => actualizar(idx, { stock: (Number(v.stock) || 0) + 1 })}
                      aria-label={`Sumar una unidad, talle ${talle?.nombreTalle ?? ''} ${nombreColor}`}
                      className="w-11 h-11 flex items-center justify-center text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {repetida && (
                  <p className="mt-2 text-[11px] font-semibold text-amber-800 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Este talle y color está repetido.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <GaleriaFotos
        abierta={visor !== null && fotosVisor.length > 0}
        fotos={fotosVisor.map((f, i) => ({
          src: f.url,
          alt: `${nombreProducto} - ${visor?.nombre ?? ''} (foto ${i + 1} de ${fotosVisor.length})`,
        }))}
        onCerrar={() => setVisor(null)}
        titulo={`${nombreProducto} · ${visor?.nombre ?? ''}`}
      />
    </BottomSheet>
  );
}
