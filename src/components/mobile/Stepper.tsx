'use client';

import React from 'react';
import { Check } from 'lucide-react';

export interface PasoStepper {
  titulo: string;
}

/** true cuando la pantalla es de celular (< 640px, el breakpoint "sm" de Tailwind) */
export function esPantallaChica() {
  return typeof window !== 'undefined' && !window.matchMedia('(min-width: 640px)').matches;
}

interface StepperProps {
  pasos: PasoStepper[];
  pasoActual: number;
  /** Se llama al tocar un paso. Quien lo usa decide si deja avanzar (validación). */
  onIrAPaso?: (indice: number) => void;
  className?: string;
}

/**
 * Indicador de pasos para formularios largos en móvil.
 * Muestra los pasos como segmentos, con el título del actual debajo.
 * Solo se ve en pantallas chicas: en escritorio el formulario se muestra completo.
 */
export function Stepper({ pasos, pasoActual, onIrAPaso, className = '' }: StepperProps) {
  return (
    <nav aria-label="Pasos del formulario" className={`sm:hidden ${className}`}>
      <ol className="flex gap-1.5">
        {pasos.map((paso, i) => {
          const hecho = i < pasoActual;
          const actual = i === pasoActual;
          return (
            <li key={paso.titulo} className="flex-1 min-w-0">
              <button
                type="button"
                onClick={() => onIrAPaso?.(i)}
                aria-current={actual ? 'step' : undefined}
                className="w-full min-h-11 flex flex-col items-start justify-center gap-1.5 text-left cursor-pointer"
              >
                <span
                  className={`h-1.5 w-full rounded-full transition-colors ${
                    hecho || actual ? 'bg-rose-600' : 'bg-slate-200'
                  }`}
                />
                <span
                  className={`flex items-center gap-1 text-[11px] font-bold truncate max-w-full ${
                    actual ? 'text-rose-600' : hecho ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  {hecho && <Check className="w-3 h-3 shrink-0" />}
                  <span className="truncate">
                    {i + 1}. {paso.titulo}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface PieStepperProps {
  pasoActual: number;
  totalPasos: number;
  onAtras: () => void;
  onSiguiente: () => void;
  onCancelar: () => void;
  /** Texto del botón final (submit) */
  textoFinal: string;
  deshabilitado?: boolean;
  /**
   * true cuando el formulario está en una página del panel (no en un modal):
   * la botonera queda encima de la barra de navegación inferior.
   */
  sobreBarraInferior?: boolean;
}

/**
 * Botonera fija al pie para móvil: Cancelar/Atrás a la izquierda y
 * Siguiente/Guardar a la derecha, a mano del pulgar.
 * En el último paso el botón principal es de tipo submit.
 */
export function PieStepper({
  pasoActual,
  totalPasos,
  onAtras,
  onSiguiente,
  onCancelar,
  textoFinal,
  deshabilitado = false,
  sobreBarraInferior = false,
}: PieStepperProps) {
  const esUltimo = pasoActual >= totalPasos - 1;
  const posicion = sobreBarraInferior
    ? 'bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] py-3'
    : 'bottom-0 pt-3 pb-safe-4';
  return (
    <div
      className={`sm:hidden sticky z-10 -mx-4 px-4 bg-white border-t border-slate-200 flex gap-2 ${posicion}`}
    >
      <button
        type="button"
        onClick={pasoActual === 0 ? onCancelar : onAtras}
        className="min-h-12 px-5 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 cursor-pointer"
      >
        {pasoActual === 0 ? 'Cancelar' : 'Atrás'}
      </button>
      {/* Claves distintas: así React no convierte el botón "Siguiente" recién tocado en
          submit dentro del mismo click (eso enviaría el formulario antes de tiempo). */}
      {esUltimo ? (
        <button
          key="guardar"
          type="submit"
          disabled={deshabilitado}
          className="flex-1 min-h-12 rounded-xl bg-rose-600 text-white text-sm font-bold active:bg-rose-700 disabled:opacity-50 cursor-pointer"
        >
          {textoFinal}
        </button>
      ) : (
        <button
          key="siguiente"
          type="button"
          onClick={onSiguiente}
          className="flex-1 min-h-12 rounded-xl bg-rose-600 text-white text-sm font-bold active:bg-rose-700 cursor-pointer"
        >
          Siguiente
        </button>
      )}
    </div>
  );
}
