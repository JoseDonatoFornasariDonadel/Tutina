'use client';

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ImagenProducto } from '@/components/tienda/ImagenProducto';

export interface FotoGaleria {
  src: string;
  alt: string;
}

interface CarruselFotosProps {
  fotos: FotoGaleria[];
  /** Foto visible (controlada por el padre) */
  indice: number;
  onCambiarIndice: (indice: number) => void;
  /** Al tocar una foto (por ejemplo, para abrirla en grande) */
  onTocarFoto?: (indice: number) => void;
  /** "cover" llena el recuadro; "contain" muestra la foto entera (pantalla completa) */
  ajuste?: 'cover' | 'contain';
  sizes?: string;
  /** Texto del botón de cada foto para lectores de pantalla */
  etiquetaTocar?: string;
  /** Muestra flechas y puntos. En el visor de pantalla completa las flechas van afuera. */
  controles?: boolean;
  className?: string;
}

/**
 * Carrusel de fotos con deslizamiento nativo (scroll-snap): en el celular se pasa de foto con
 * el dedo, con la inercia propia del sistema; en escritorio, con flechas o el teclado.
 */
export function CarruselFotos({
  fotos,
  indice,
  onCambiarIndice,
  onTocarFoto,
  ajuste = 'cover',
  sizes = '100vw',
  etiquetaTocar,
  controles = true,
  className = '',
}: CarruselFotosProps) {
  const pistaRef = useRef<HTMLDivElement>(null);
  const indiceRef = useRef(indice);
  const total = fotos.length;

  const irA = useCallback(
    (destino: number, suave = true) => {
      const pista = pistaRef.current;
      if (!pista || total === 0) return;
      const i = Math.max(0, Math.min(total - 1, destino));
      pista.scrollTo({ left: i * pista.clientWidth, behavior: suave ? 'smooth' : 'auto' });
    },
    [total]
  );

  // Posición inicial sin animación
  useLayoutEffect(() => {
    irA(indiceRef.current, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // Si el padre cambia la foto (flechas, otro color), la pista se desplaza hasta ella
  useEffect(() => {
    const pista = pistaRef.current;
    indiceRef.current = indice;
    if (!pista || pista.clientWidth === 0) return;
    const actual = Math.round(pista.scrollLeft / pista.clientWidth);
    if (actual !== indice) irA(indice);
  }, [indice, irA]);

  // Al deslizar con el dedo se actualiza la foto visible. Se espera a que el movimiento
  // termine: durante un desplazamiento animado las posiciones intermedias no cuentan.
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alDesplazar = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      const pista = pistaRef.current;
      if (!pista || pista.clientWidth === 0) return;
      const actual = Math.round(pista.scrollLeft / pista.clientWidth);
      if (actual !== indiceRef.current && actual >= 0 && actual < total) {
        indiceRef.current = actual;
        onCambiarIndice(actual);
      }
    }, 90);
  };
  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    []
  );

  // Al rotar el celular o cambiar el tamaño, se mantiene la misma foto
  useEffect(() => {
    const pista = pistaRef.current;
    if (!pista || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(() => irA(indiceRef.current, false));
    obs.observe(pista);
    return () => obs.disconnect();
  }, [irA]);

  const varias = total > 1;

  return (
    <div
      className={`relative h-full w-full ${className}`}
      aria-roledescription="carrusel"
      onKeyDown={(e) => {
        if (!varias) return;
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          onCambiarIndice(Math.min(total - 1, indice + 1));
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onCambiarIndice(Math.max(0, indice - 1));
        }
      }}
    >
      <div
        ref={pistaRef}
        onScroll={alDesplazar}
        className="flex h-full w-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory overscroll-x-contain scroll-touch [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {fotos.map((foto, i) => {
          const imagen = (
            <ImagenProducto
              src={foto.src}
              alt={foto.alt}
              fill
              sizes={sizes}
              priority={i === indice}
              draggable={false}
              className={`select-none ${ajuste === 'cover' ? 'object-cover' : 'object-contain'}`}
            />
          );
          return (
            <div
              key={`${foto.src}-${i}`}
              role="group"
              aria-roledescription="foto"
              aria-label={`${i + 1} de ${total}`}
              aria-hidden={i !== indice}
              className="relative h-full w-full shrink-0 snap-center snap-always"
            >
              {onTocarFoto ? (
                <button
                  type="button"
                  tabIndex={i === indice ? 0 : -1}
                  onClick={() => onTocarFoto(i)}
                  aria-label={etiquetaTocar ? `${etiquetaTocar} (${i + 1} de ${total})` : foto.alt}
                  className={`absolute inset-0 ${
                    ajuste === 'contain' ? 'cursor-zoom-out' : 'cursor-zoom-in'
                  }`}
                >
                  {imagen}
                </button>
              ) : (
                imagen
              )}
            </div>
          );
        })}
      </div>

      {varias && controles && (
        <>
          <BotonFlecha
            direccion="anterior"
            disabled={indice === 0}
            onClick={() => onCambiarIndice(indice - 1)}
            className="left-2"
          />
          <BotonFlecha
            direccion="siguiente"
            disabled={indice === total - 1}
            onClick={() => onCambiarIndice(indice + 1)}
            className="right-2"
          />
          <PuntosGaleria total={total} indice={indice} onElegir={onCambiarIndice} />
        </>
      )}
    </div>
  );
}

function BotonFlecha({
  direccion,
  disabled,
  onClick,
  className = '',
  grande = false,
}: {
  direccion: 'anterior' | 'siguiente';
  disabled: boolean;
  onClick: () => void;
  className?: string;
  grande?: boolean;
}) {
  const Icono = direccion === 'anterior' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      aria-label={direccion === 'anterior' ? 'Foto anterior' : 'Foto siguiente'}
      // En celular se desliza con el dedo: las flechas pequeñas solo aparecen desde sm
      className={`absolute top-1/2 -translate-y-1/2 z-10 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-lg backdrop-blur-sm transition hover:bg-white disabled:opacity-0 disabled:pointer-events-none cursor-pointer ${
        grande ? 'hidden sm:flex w-12 h-12' : 'hidden sm:flex w-10 h-10'
      } ${className}`}
    >
      <Icono className={grande ? 'w-6 h-6' : 'w-5 h-5'} />
    </button>
  );
}

function PuntosGaleria({
  total,
  indice,
  onElegir,
  oscuro = false,
}: {
  total: number;
  indice: number;
  onElegir: (i: number) => void;
  oscuro?: boolean;
}) {
  return (
    <div
      className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-full px-1.5 py-1 ${
        oscuro ? 'bg-white/15' : 'bg-slate-900/45'
      } backdrop-blur-sm`}
    >
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onElegir(i);
          }}
          aria-label={`Ver foto ${i + 1} de ${total}`}
          aria-current={i === indice ? 'true' : undefined}
          // Área táctil de 24px alrededor de cada punto
          className="flex h-6 w-6 items-center justify-center cursor-pointer"
        >
          <span
            className={`block h-2 rounded-full bg-[#fff] transition-all ${
              i === indice ? 'w-5' : 'w-2 opacity-60'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

interface GaleriaFotosProps {
  abierta: boolean;
  fotos: FotoGaleria[];
  /** Foto con la que se abre */
  indiceInicial?: number;
  onCerrar: () => void;
  /** Título que se anuncia (por ejemplo "Remera Dry-Fit · Rojo") */
  titulo: string;
  /** Avisa qué foto quedó visible al cerrar, para sincronizar el carrusel de fondo */
  onCambiarIndice?: (indice: number) => void;
}

/**
 * Visor de fotos a pantalla completa con el fondo difuminado.
 * - Celular: se desliza con el dedo entre las fotos del color.
 * - Escritorio: flechas grandes, teclado (← →) y miniaturas.
 * - Se cierra con la X, con Escape o tocando fuera de la foto.
 */
export function GaleriaFotos(props: GaleriaFotosProps) {
  if (!props.abierta || props.fotos.length === 0 || typeof document === 'undefined') return null;
  // Se monta de nuevo en cada apertura: arranca directo en la foto elegida
  return createPortal(<VisorAbierto {...props} />, document.body);
}

function VisorAbierto({
  fotos,
  indiceInicial = 0,
  onCerrar,
  titulo,
  onCambiarIndice,
}: GaleriaFotosProps) {
  const idTitulo = useId();
  const dialogoRef = useRef<HTMLDivElement>(null);
  const total = fotos.length;
  const [indice, setIndice] = useState(() =>
    Math.min(Math.max(0, indiceInicial), Math.max(0, total - 1))
  );

  const cambiar = useCallback(
    (i: number) => {
      const destino = Math.max(0, Math.min(total - 1, i));
      setIndice(destino);
      onCambiarIndice?.(destino);
    },
    [total, onCambiarIndice]
  );

  const refCerrar = useRef(onCerrar);
  refCerrar.current = onCerrar;
  const refCambiar = useRef(cambiar);
  refCambiar.current = cambiar;
  const refIndice = useRef(indice);
  refIndice.current = indice;

  // Teclado, foco y scroll de la página mientras está abierta
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogoRef.current?.focus({ preventScroll: true });
    const alTeclear = (e: KeyboardEvent) => {
      // En captura: Escape cierra solo el visor, no la ventana que queda debajo
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        refCerrar.current();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        refCambiar.current(refIndice.current + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        refCambiar.current(refIndice.current - 1);
      }
    };
    window.addEventListener('keydown', alTeclear, true);
    return () => {
      window.removeEventListener('keydown', alTeclear, true);
      document.body.style.overflow = overflowPrevio;
      previo?.focus?.({ preventScroll: true });
    };
  }, []);

  const varias = total > 1;

  // Va en un portal al body: ninguna ventana con animación o scroll de fondo lo recorta
  return (
    <div
      ref={dialogoRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={idTitulo}
      className="animate-sheet-fondo-entrada fixed inset-0 z-[70] flex flex-col bg-slate-950/70 backdrop-blur-xl outline-none pt-safe pb-safe"
    >
      {/* Barra superior: título, contador y cerrar */}
      <div className="relative z-20 flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1 text-white">
          <h2 id={idTitulo} className="truncate text-sm font-bold">
            {titulo}
          </h2>
          {varias && (
            <p className="text-xs font-semibold text-white/80" aria-live="polite">
              Foto {indice + 1} de {total}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar fotos"
          className="touch-target shrink-0 rounded-full bg-white/90 text-slate-800 shadow-lg cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Fotos: tocar el fondo (fuera de la foto) cierra el visor */}
      <div className="relative min-h-0 flex-1">
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={onCerrar}
          className="absolute inset-0 cursor-zoom-out"
        />
        <div className="pointer-events-none absolute inset-0 mx-auto max-w-5xl sm:px-20">
          <div className="pointer-events-auto h-full">
            <CarruselFotos
              fotos={fotos}
              indice={indice}
              onCambiarIndice={cambiar}
              ajuste="contain"
              sizes="100vw"
              controles={false}
              // Tocar la foto (sin deslizar) cierra el visor, como en las apps de fotos
              onTocarFoto={onCerrar}
              etiquetaTocar="Cerrar fotos"
            />
          </div>
        </div>
        {varias && (
          <>
            <BotonFlecha
              direccion="anterior"
              disabled={indice === 0}
              onClick={() => cambiar(indice - 1)}
              className="left-4"
              grande
            />
            <BotonFlecha
              direccion="siguiente"
              disabled={indice === total - 1}
              onClick={() => cambiar(indice + 1)}
              className="right-4"
              grande
            />
          </>
        )}
      </div>

      {/* Miniaturas (escritorio) o puntos (celular) */}
      {varias && (
        <div className="relative z-20 flex justify-center px-4 pt-3 pb-4">
          <div className="sm:hidden relative h-8 w-full">
            <PuntosGaleria total={total} indice={indice} onElegir={cambiar} oscuro />
          </div>
          <div className="hidden sm:flex max-w-full gap-2 overflow-x-auto scroll-touch p-1">
            {fotos.map((foto, i) => (
              <button
                key={`${foto.src}-${i}`}
                type="button"
                onClick={() => cambiar(i)}
                aria-label={`Ver foto ${i + 1} de ${total}`}
                aria-current={i === indice ? 'true' : undefined}
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl transition cursor-pointer ${
                  i === indice
                    ? 'ring-2 ring-white opacity-100'
                    : 'opacity-60 hover:opacity-100'
                }`}
              >
                <ImagenProducto src={foto.src} alt="" fill sizes="64px" className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
