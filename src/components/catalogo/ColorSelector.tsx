'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Search } from 'lucide-react';

export interface ColorOpcion {
  codColor: number;
  nombreColor: string;
  codigoHex: string;
}

interface ColorSelectorProps {
  colores: ColorOpcion[];
  value: number | undefined;
  onChange: (color: ColorOpcion) => void;
  /** Crea el color en la base y devuelve el registro creado. */
  onCrearColor: (nombreColor: string, codigoHex: string) => Promise<ColorOpcion>;
  className?: string;
}

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * Selector de color con buscador y alta inline ("Crear nuevo color: ...").
 */
export function ColorSelector({
  colores,
  value,
  onChange,
  onCrearColor,
  className = '',
}: ColorSelectorProps) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [hexNuevo, setHexNuevo] = useState('#111827');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [indiceActivo, setIndiceActivo] = useState(0);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const seleccionado = colores.find((c) => c.codColor === Number(value));

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda);
    const lista = [...colores].sort((a, b) => a.nombreColor.localeCompare(b.nombreColor, 'es'));
    return q ? lista.filter((c) => normalizar(c.nombreColor).includes(q)) : lista;
  }, [colores, busqueda]);

  const textoBusqueda = busqueda.trim();
  const existeExacto = colores.some(
    (c) => normalizar(c.nombreColor) === normalizar(textoBusqueda)
  );
  const puedeCrear = textoBusqueda.length > 0 && !existeExacto;

  // Cerrar al hacer clic afuera
  useEffect(() => {
    if (!abierto) return;
    const handler = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [abierto]);

  useEffect(() => {
    if (abierto) {
      setBusqueda('');
      setError(null);
      setIndiceActivo(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [abierto]);

  useEffect(() => {
    setIndiceActivo(0);
  }, [busqueda]);

  const elegir = (c: ColorOpcion) => {
    onChange(c);
    setAbierto(false);
  };

  const crear = async () => {
    if (!puedeCrear || creando) return;
    setCreando(true);
    setError(null);
    try {
      const nuevo = await onCrearColor(textoBusqueda, hexNuevo);
      elegir(nuevo);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el color');
    } finally {
      setCreando(false);
    }
  };

  // Opciones navegables con el teclado: colores filtrados + "crear" al final
  const totalOpciones = filtrados.length + (puedeCrear ? 1 : 0);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceActivo((i) => Math.min(i + 1, Math.max(0, totalOpciones - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      // Evita que Enter envíe el formulario de la prenda
      e.preventDefault();
      if (indiceActivo < filtrados.length) {
        const c = filtrados[indiceActivo];
        if (c) elegir(c);
      } else if (puedeCrear) {
        crear();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setAbierto(false);
    }
  };

  return (
    <div ref={contenedorRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className="w-full px-2.5 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white flex items-center justify-between gap-2 cursor-pointer hover:border-rose-300"
      >
        <span className="flex items-center gap-2 min-w-0">
          {seleccionado && (
            <span
              className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
              style={{ backgroundColor: seleccionado.codigoHex }}
            />
          )}
          <span className="truncate">
            {seleccionado ? seleccionado.nombreColor : 'Elegir color...'}
          </span>
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>

      {abierto && (
        <div className="absolute z-40 mt-1 w-full min-w-[260px] rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Buscar o crear color..."
                className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-rose-300 outline-none"
              />
            </div>
          </div>

          <ul className="max-h-56 overflow-y-auto py-1" role="listbox">
            {filtrados.map((c, i) => {
              const activo = i === indiceActivo;
              const esSeleccionado = c.codColor === Number(value);
              return (
                <li key={c.codColor} role="option" aria-selected={esSeleccionado}>
                  <button
                    type="button"
                    onMouseEnter={() => setIndiceActivo(i)}
                    onClick={() => elegir(c)}
                    className={`w-full px-3 py-1.5 text-xs flex items-center justify-between gap-2 cursor-pointer ${
                      activo ? 'bg-rose-50 text-rose-900' : 'text-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                        style={{ backgroundColor: c.codigoHex }}
                      />
                      <span className="truncate">{c.nombreColor}</span>
                    </span>
                    {esSeleccionado && <Check className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                  </button>
                </li>
              );
            })}

            {filtrados.length === 0 && !puedeCrear && (
              <li className="px-3 py-2 text-xs text-slate-400">No hay colores cargados.</li>
            )}

            {puedeCrear && (
              <li className="border-t border-slate-100 mt-1 pt-1">
                <div
                  onMouseEnter={() => setIndiceActivo(filtrados.length)}
                  className={`px-3 py-2 flex items-center gap-2 ${
                    indiceActivo === filtrados.length ? 'bg-emerald-50' : ''
                  }`}
                >
                  <input
                    type="color"
                    value={hexNuevo}
                    onChange={(e) => setHexNuevo(e.target.value)}
                    title="Elegí el tono del nuevo color"
                    className="w-6 h-6 rounded border border-slate-300 cursor-pointer shrink-0 p-0"
                  />
                  <button
                    type="button"
                    onClick={crear}
                    disabled={creando}
                    className="flex-1 min-w-0 text-left text-xs font-semibold text-emerald-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span className="break-words">
                      {creando ? 'Creando...' : `Crear nuevo color: "${textoBusqueda}"`}
                    </span>
                  </button>
                </div>
              </li>
            )}
          </ul>

          {error && (
            <div className="px-3 py-2 text-[11px] text-rose-700 bg-rose-50 border-t border-rose-100">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
