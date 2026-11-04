'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Search } from 'lucide-react';

export interface OpcionCreable {
  id: number;
  nombre: string;
}

interface SelectorCreableProps {
  opciones: OpcionCreable[];
  value: number | null | undefined;
  onChange: (opcion: OpcionCreable) => void;
  /** Crea el registro en la base y devuelve el creado. */
  onCrear: (nombre: string) => Promise<OpcionCreable>;
  /** Texto del botón cuando no hay nada elegido. */
  placeholder?: string;
  /** Texto del buscador. */
  placeholderBusqueda?: string;
  /** Sustantivo para mensajes ("categoría", "marca"...). */
  entidad?: string;
  className?: string;
  /** Para asociar el control a un <label htmlFor>. */
  id?: string;
}

/** Minúsculas, sin acentos y sin espacios repetidos: "Calzas" y "calzas " son iguales. */
export function normalizarTexto(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Selector con buscador y alta en línea: si lo escrito no existe, ofrece
 * "Crear: [texto]", lo guarda en la base y lo deja elegido.
 */
export function SelectorCreable({
  opciones,
  value,
  onChange,
  onCrear,
  placeholder = 'Elegir...',
  placeholderBusqueda = 'Buscar o crear...',
  entidad = 'opción',
  className = '',
  id,
}: SelectorCreableProps) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [indiceActivo, setIndiceActivo] = useState(0);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const seleccionada = opciones.find((o) => o.id === Number(value));

  const filtradas = useMemo(() => {
    const q = normalizarTexto(busqueda);
    const lista = [...opciones].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return q ? lista.filter((o) => normalizarTexto(o.nombre).includes(q)) : lista;
  }, [opciones, busqueda]);

  const textoBusqueda = busqueda.trim().replace(/\s+/g, ' ');
  const existente = opciones.find(
    (o) => normalizarTexto(o.nombre) === normalizarTexto(textoBusqueda)
  );
  const puedeCrear = textoBusqueda.length > 0 && !existente;

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

  const elegir = (o: OpcionCreable) => {
    onChange(o);
    setAbierto(false);
  };

  const crear = async () => {
    if (!puedeCrear || creando) return;
    setCreando(true);
    setError(null);
    try {
      const nueva = await onCrear(textoBusqueda);
      elegir(nueva);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `No se pudo crear la ${entidad}`);
    } finally {
      setCreando(false);
    }
  };

  // Opciones navegables con el teclado: las filtradas + "Crear" al final
  const totalOpciones = filtradas.length + (puedeCrear ? 1 : 0);

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
      if (indiceActivo < filtradas.length) {
        const o = filtradas[indiceActivo];
        if (o) elegir(o);
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
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-2 cursor-pointer hover:border-rose-300 transition text-left"
      >
        <span className={`truncate ${seleccionada ? 'text-slate-800' : 'text-slate-400'}`}>
          {seleccionada ? seleccionada.nombre : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </button>

      {abierto && (
        <div className="absolute z-50 mt-1 w-full min-w-[240px] rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                value={busqueda}
                maxLength={60}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholderBusqueda}
                className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-rose-300 outline-none"
              />
            </div>
          </div>

          <ul className="max-h-56 overflow-y-auto py-1" role="listbox">
            {filtradas.map((o, i) => {
              const activo = i === indiceActivo;
              const esSeleccionada = o.id === Number(value);
              return (
                <li key={o.id} role="option" aria-selected={esSeleccionada}>
                  <button
                    type="button"
                    onMouseEnter={() => setIndiceActivo(i)}
                    onClick={() => elegir(o)}
                    className={`w-full px-3 py-1.5 text-xs flex items-center justify-between gap-2 cursor-pointer text-left ${
                      activo ? 'bg-rose-50 text-rose-900' : 'text-slate-700'
                    }`}
                  >
                    <span className="truncate">{o.nombre}</span>
                    {esSeleccionada && <Check className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                  </button>
                </li>
              );
            })}

            {filtradas.length === 0 && !puedeCrear && (
              <li className="px-3 py-2 text-xs text-slate-400">No hay resultados.</li>
            )}

            {puedeCrear && (
              <li className="border-t border-slate-100 mt-1 pt-1">
                <button
                  type="button"
                  onMouseEnter={() => setIndiceActivo(filtradas.length)}
                  onClick={crear}
                  disabled={creando}
                  className={`w-full px-3 py-2 text-left text-xs font-semibold text-emerald-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                    indiceActivo === filtradas.length ? 'bg-emerald-50' : ''
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span className="break-words">
                    {creando ? 'Creando...' : `Crear: "${textoBusqueda}"`}
                  </span>
                </button>
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
