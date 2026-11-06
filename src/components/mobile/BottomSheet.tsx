'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  subtitulo?: string;
  /** Contenido con scroll propio (lista de filtros, variantes, etc.) */
  children: React.ReactNode;
  /** Zona fija abajo, a mano del pulgar: botones "Aplicar", "Limpiar", etc. */
  pie?: React.ReactNode;
  /** Altura máxima del panel. Por defecto 85% del alto visible. */
  alturaMaxima?: string;
  /** Ancho del panel centrado en escritorio (clase de Tailwind). Por defecto sm:max-w-lg. */
  anchoEscritorio?: string;
  /** Elemento extra junto al título (por ejemplo, un contador) */
  accesorioTitulo?: React.ReactNode;
  /** z-index para apilarlo sobre otra ventana (por defecto z-50) */
  zIndexClass?: string;
}

// Distancia (px) que hay que arrastrar hacia abajo para cerrar el panel
const UMBRAL_CIERRE = 110;
const DURACION_SALIDA_MS = 220;

/**
 * Modal que sube desde abajo, pensado para usarse con una mano.
 * - Se cierra tocando el fondo, con Escape o arrastrando la manija hacia abajo.
 * - Bloquea el scroll de la página mientras está abierto (sin saltos en iOS).
 * - Respeta el área segura inferior (barra de inicio del iPhone).
 * En pantallas grandes se muestra como un panel centrado.
 */
export function BottomSheet({
  abierto,
  onCerrar,
  titulo,
  subtitulo,
  children,
  pie,
  alturaMaxima = '85dvh',
  anchoEscritorio = 'sm:max-w-lg',
  accesorioTitulo,
  zIndexClass = 'z-50',
}: BottomSheetProps) {
  const idTitulo = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [montado, setMontado] = useState(abierto);
  const [saliendo, setSaliendo] = useState(false);
  const [arrastre, setArrastre] = useState(0);
  const inicioArrastre = useRef<number | null>(null);

  // Mantiene el panel montado mientras corre la animación de salida
  useEffect(() => {
    if (abierto) {
      setMontado(true);
      setSaliendo(false);
      return;
    }
    if (!montado) return;
    setSaliendo(true);
    const t = setTimeout(() => {
      setMontado(false);
      setSaliendo(false);
      setArrastre(0);
    }, DURACION_SALIDA_MS);
    return () => clearTimeout(t);
  }, [abierto, montado]);

  // Se guarda en una ref: si el padre pasa una función nueva en cada render, el panel
  // no vuelve a tomar el foco (lo que interrumpiría a quien está escribiendo adentro)
  const refCerrar = useRef(onCerrar);
  refCerrar.current = onCerrar;

  // Bloqueo de scroll del body, cierre con Escape y foco al abrir
  useEffect(() => {
    if (!abierto) return;
    const previo = document.activeElement as HTMLElement | null;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') refCerrar.current();
    };
    window.addEventListener('keydown', alTeclear);
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflowPrevio;
      window.removeEventListener('keydown', alTeclear);
      // El foco vuelve al botón que abrió el panel
      previo?.focus?.({ preventScroll: true });
    };
  }, [abierto]);

  const alEmpezarArrastre = useCallback((e: React.PointerEvent) => {
    inicioArrastre.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const alArrastrar = useCallback((e: React.PointerEvent) => {
    if (inicioArrastre.current === null) return;
    setArrastre(Math.max(0, e.clientY - inicioArrastre.current));
  }, []);

  const alSoltar = useCallback(() => {
    if (inicioArrastre.current === null) return;
    inicioArrastre.current = null;
    if (arrastre > UMBRAL_CIERRE) {
      onCerrar();
    } else {
      setArrastre(0);
    }
  }, [arrastre, onCerrar]);

  if (!montado) return null;

  const arrastrando = inicioArrastre.current !== null;

  return (
    <div className={`fixed inset-0 ${zIndexClass} flex items-end justify-center sm:items-center sm:p-6`}>
      {/* Fondo: tocarlo cierra el panel */}
      <div
        aria-hidden="true"
        onClick={onCerrar}
        className={`absolute inset-0 bg-slate-900/60 backdrop-blur-xs ${
          saliendo ? 'animate-sheet-fondo-salida' : 'animate-sheet-fondo-entrada'
        }`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        style={{
          maxHeight: alturaMaxima,
          transform: arrastre ? `translateY(${arrastre}px)` : undefined,
          transition: arrastrando ? 'none' : undefined,
        }}
        className={`relative w-full ${anchoEscritorio} flex flex-col bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl outline-none transition-transform duration-200 ${
          saliendo ? 'animate-sheet-salida' : 'animate-sheet-entrada'
        }`}
      >
        {/* Manija de arrastre (solo móvil) */}
        <div
          onPointerDown={alEmpezarArrastre}
          onPointerMove={alArrastrar}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
          className="sm:hidden flex justify-center pt-3 pb-1 cursor-grab touch-none"
        >
          <span className="h-1.5 w-11 rounded-full bg-slate-300" />
        </div>

        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3 px-5 pt-2 sm:pt-5 pb-3 border-b border-slate-100">
          <div className="min-w-0">
            <h2 id={idTitulo} className="text-base font-extrabold text-slate-900 truncate">
              {titulo}
            </h2>
            {subtitulo && <p className="text-xs text-slate-500 mt-0.5">{subtitulo}</p>}
          </div>
          {accesorioTitulo && <div className="ml-auto shrink-0">{accesorioTitulo}</div>}
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="touch-target -mr-2 -mt-1 rounded-full text-slate-500 hover:bg-slate-100 hover:text-rose-600 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido con scroll propio */}
        <div className="flex-1 min-h-0 overflow-y-auto scroll-touch px-5 py-4">{children}</div>

        {/* Pie fijo con acciones */}
        {pie && (
          <div className="px-5 pt-3 pb-safe-4 border-t border-slate-100 bg-white rounded-b-none sm:rounded-b-3xl">
            {pie}
          </div>
        )}
        {!pie && <div className="pb-safe" />}
      </div>
    </div>
  );
}
