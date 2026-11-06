'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ImagePlus,
  Loader2,
  RefreshCw,
  Star,
  Trash2,
} from 'lucide-react';
import { BottomSheet } from '@/components/mobile/BottomSheet';
import { GaleriaFotos } from '@/components/galeria/GaleriaFotos';
import { ImagenProducto } from '@/components/tienda/ImagenProducto';
import { comprimirImagen } from '@/lib/comprimirImagen';
import { mapearTextoAColorHex } from '@/lib/colores';
import type { AccionesGaleria, GaleriaPrenda } from '@/components/catalogo/galeriaPrenda';

export interface ColorDeLaPrenda {
  codColor: number;
  nombreColor: string;
  codigoHex: string;
  /** Talles de ese color en la edición actual (incluye los que todavía no se guardaron) */
  talles: string[];
}

interface GestionFotosSheetProps {
  abierto: boolean;
  onCerrar: () => void;
  /**
   * Qué hacer con cada cambio: guardarlo al instante en el servidor (prenda existente,
   * accionesGaleriaServidor) o en memoria hasta crear la prenda (useGaleriaBorrador).
   */
  acciones: AccionesGaleria;
  nombreProducto: string;
  /** Colores que tiene la prenda en la edición actual */
  colores: ColorDeLaPrenda[];
  galeria: GaleriaPrenda | null;
  cargando: boolean;
  error: string | null;
  faltaActualizarBase: boolean;
  onReintentar: () => void;
  /** La galería cambió en el servidor (solo en modo "guardado") */
  onGaleriaActualizada?: (galeria: GaleriaPrenda) => void;
  /** z-index del panel, para apilarlo sobre otra ventana */
  zIndexClass?: string;
  /** Color que se muestra al abrir */
  codColorInicial?: number;
}

interface SubidaPendiente {
  id: string;
  vistaPrevia: string;
}

type Aviso = { tipo: 'ok' | 'error'; texto: string } | null;

/**
 * Panel dedicado a las fotos de la prenda, separado por color.
 * Las fotos de un color se comparten entre todos sus talles. Cada acción (agregar,
 * eliminar, elegir portada) se guarda al instante.
 * Bottom sheet en el celular, ventana centrada en escritorio.
 */
export function GestionFotosSheet({
  abierto,
  onCerrar,
  acciones,
  nombreProducto,
  colores,
  galeria,
  cargando,
  error,
  faltaActualizarBase,
  onReintentar,
  onGaleriaActualizada,
  codColorInicial,
  zIndexClass,
}: GestionFotosSheetProps) {
  const esBorrador = acciones.modo === 'borrador';
  const [codColorActivo, setCodColorActivo] = useState<number | undefined>(codColorInicial);
  const [subiendo, setSubiendo] = useState<SubidaPendiente[]>([]);
  const [progreso, setProgreso] = useState<{ actual: number; total: number } | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);
  const [ocupadoId, setOcupadoId] = useState<number | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [visor, setVisor] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Colores de la edición + colores que solo tienen fotos guardadas
  const listaColores = useMemo(() => {
    const mapa = new Map<number, ColorDeLaPrenda & { cantidad: number }>();
    for (const c of colores) mapa.set(c.codColor, { ...c, cantidad: 0 });
    for (const c of galeria?.colores ?? []) {
      const previo = mapa.get(c.codColor);
      mapa.set(c.codColor, {
        codColor: c.codColor,
        nombreColor: c.nombreColor,
        codigoHex: c.codigoHex,
        talles: previo?.talles ?? c.talles,
        cantidad: c.fotos.length,
      });
    }
    return [...mapa.values()];
  }, [colores, galeria]);

  // Al abrir: el color pedido, o el primero
  useEffect(() => {
    if (!abierto) return;
    setCodColorActivo((actual) => {
      if (codColorInicial !== undefined) return codColorInicial;
      return listaColores.some((c) => c.codColor === actual) ? actual : listaColores[0]?.codColor;
    });
    setConfirmandoId(null);
    setAviso(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, codColorInicial]);

  // El aviso de confirmación desaparece solo
  useEffect(() => {
    if (aviso?.tipo !== 'ok') return;
    const t = setTimeout(() => setAviso(null), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  const colorActivo =
    listaColores.find((c) => c.codColor === codColorActivo) ?? listaColores[0] ?? null;
  const fotos = galeria?.colores.find((c) => c.codColor === colorActivo?.codColor)?.fotos ?? [];
  const maxFotos = galeria?.maxFotosPorColor ?? 10;
  const lugaresLibres = Math.max(0, maxFotos - fotos.length - subiendo.length);
  const ocupado = subiendo.length > 0 || ocupadoId !== null;

  // Ejecuta una acción (servidor o borrador) y avisa el resultado
  const ejecutar = async (accion: Promise<GaleriaPrenda | void>, textoOk: string) => {
    const nueva = await accion;
    if (nueva) onGaleriaActualizada?.(nueva);
    if (textoOk) setAviso({ tipo: 'ok', texto: textoOk });
  };

  const agregarFotos = async (archivos: FileList | null) => {
    if (!archivos || archivos.length === 0 || !colorActivo) return;
    const lista = Array.from(archivos).filter((f) => f.type.startsWith('image/'));
    const aSubir = lista.slice(0, lugaresLibres);
    if (aSubir.length === 0) {
      setAviso({ tipo: 'error', texto: `Este color ya tiene el máximo de ${maxFotos} fotos.` });
      return;
    }
    const pendientes = aSubir.map((f, i) => ({
      id: `${Date.now()}-${i}`,
      vistaPrevia: URL.createObjectURL(f),
    }));
    setSubiendo(pendientes);
    setAviso(null);
    let subidas = 0;
    try {
      // De a una: cada foto viaja en su propia petición (límite de 4,5 MB de Vercel)
      for (let i = 0; i < aSubir.length; i++) {
        setProgreso({ actual: i + 1, total: aSubir.length });
        const imagen = await comprimirImagen(aSubir[i]);
        await ejecutar(acciones.agregar(colorActivo.codColor, imagen), '');
        subidas++;
        URL.revokeObjectURL(pendientes[i].vistaPrevia);
        setSubiendo((prev) => prev.filter((p) => p.id !== pendientes[i].id));
      }
      const omitidas = lista.length - aSubir.length;
      setAviso({
        tipo: 'ok',
        texto:
          (subidas === 1 ? 'Foto agregada.' : `${subidas} fotos agregadas.`) +
          (omitidas > 0 ? ` ${omitidas} no entraron (máximo ${maxFotos} por color).` : ''),
      });
    } catch (e) {
      setAviso({
        tipo: 'error',
        texto:
          (subidas > 0 ? `Se agregaron ${subidas} de ${aSubir.length}. ` : '') +
          (e instanceof Error ? e.message : 'No se pudo subir la foto.'),
      });
    } finally {
      pendientes.forEach((p) => URL.revokeObjectURL(p.vistaPrevia));
      setSubiendo([]);
      setProgreso(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const eliminarFoto = async (idFoto: number) => {
    setOcupadoId(idFoto);
    try {
      if (!colorActivo) return;
      await ejecutar(acciones.eliminar(colorActivo.codColor, idFoto), 'Foto eliminada.');
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo eliminar.' });
    } finally {
      setOcupadoId(null);
      setConfirmandoId(null);
    }
  };

  const usarDePortada = async (idFoto: number) => {
    if (!colorActivo) return;
    setOcupadoId(idFoto);
    try {
      await ejecutar(
        acciones.ordenar(colorActivo.codColor, [
          idFoto,
          ...fotos.map((f) => f.idFoto).filter((id) => id !== idFoto),
        ]),
        'Portada actualizada: es la primera foto que se ve en la tienda.'
      );
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo cambiar.' });
    } finally {
      setOcupadoId(null);
    }
  };

  const totalFotos = (galeria?.colores ?? []).reduce((acc, c) => acc + c.fotos.length, 0);

  return (
    <BottomSheet
      abierto={abierto}
      onCerrar={() => {
        // Mientras sube una foto, el panel no se cierra (se perdería la subida)
        if (subiendo.length === 0) onCerrar();
      }}
      titulo="Gestionar fotos"
      subtitulo={nombreProducto}
      alturaMaxima="92dvh"
      anchoEscritorio="sm:max-w-3xl"
      zIndexClass={zIndexClass}
      accesorioTitulo={
        galeria ? (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
            {totalFotos} {totalFotos === 1 ? 'foto' : 'fotos'}
          </span>
        ) : null
      }
      pie={
        <div className="flex items-center gap-3">
          <p className="flex-1 text-xs text-slate-500 flex items-center gap-1.5">
            {ocupado ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600 shrink-0" />
                {progreso
                  ? `Subiendo foto ${progreso.actual} de ${progreso.total}…`
                  : 'Guardando…'}
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                {esBorrador
                  ? 'Se guardan al crear la prenda.'
                  : 'Cada cambio se guarda al instante.'}
              </>
            )}
          </p>
          <button
            type="button"
            onClick={onCerrar}
            disabled={subiendo.length > 0}
            className="min-h-12 px-6 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
          >
            Listo
          </button>
        </div>
      }
    >
      {faltaActualizarBase ? (
        <div className="p-4 rounded-2xl border border-amber-300 bg-amber-50 text-sm text-amber-900 flex gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
          <p>{error}</p>
        </div>
      ) : error && !galeria ? (
        <div className="py-10 text-center space-y-3">
          <p className="text-sm text-slate-600">{error}</p>
          <button
            type="button"
            onClick={onReintentar}
            className="inline-flex items-center gap-2 min-h-11 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Reintentar
          </button>
        </div>
      ) : !galeria && cargando ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5" aria-busy="true" aria-label="Cargando fotos">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="aspect-[4/5] rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : listaColores.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          La prenda no tiene colores todavía. Agregá un talle y color en «Gestionar variantes».
        </p>
      ) : (
        <div className="space-y-4">
          {/* Selector de color: cada color tiene su propia galería */}
          <div
            role="tablist"
            aria-label="Color"
            className="scroll-chips -mx-5 px-5 scroll-px-5 flex gap-2 pb-1"
          >
            {listaColores.map((c) => {
              const activo = c.codColor === colorActivo?.codColor;
              return (
                <button
                  key={c.codColor}
                  type="button"
                  role="tab"
                  aria-selected={activo}
                  disabled={ocupado}
                  onClick={() => {
                    setCodColorActivo(c.codColor);
                    setConfirmandoId(null);
                  }}
                  className={`shrink-0 inline-flex items-center gap-2 min-h-11 pl-2.5 pr-3 rounded-full border text-sm font-semibold transition cursor-pointer disabled:cursor-not-allowed ${
                    activo
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded-full border border-black/10 dark:border-white/40 shrink-0"
                    style={{ backgroundColor: mapearTextoAColorHex(c.nombreColor, c.codigoHex) }}
                  />
                  {c.nombreColor}
                  <span
                    className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold inline-flex items-center justify-center ${
                      activo ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {c.cantidad}
                  </span>
                </button>
              );
            })}
          </div>

          {colorActivo && (
            <p className="text-xs text-slate-600">
              {colorActivo.talles.length > 0 ? (
                <>
                  Estas fotos se muestran en los talles{' '}
                  <strong className="text-slate-900">{colorActivo.talles.join(' · ')}</strong> de{' '}
                  {colorActivo.nombreColor}. La primera es la portada.
                </>
              ) : (
                <>
                  {esBorrador
                    ? 'Este color no tiene talles: sus fotos no se guardan si no le agregás uno en «Gestionar variantes».'
                    : 'Este color no tiene talles activos: las fotos quedan guardadas para cuando los agregues.'}
                </>
              )}
            </p>
          )}

          {/* Fotos del color */}
          <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {fotos.map((foto, i) => {
              const confirmando = confirmandoId === foto.idFoto;
              const enCurso = ocupadoId === foto.idFoto;
              return (
                <li
                  key={foto.idFoto}
                  className="animate-sheet-fondo-entrada relative aspect-[4/5] rounded-xl overflow-hidden bg-slate-100 border border-slate-200"
                >
                  <button
                    type="button"
                    onClick={() => setVisor(i)}
                    aria-label={`Ver foto ${i + 1} en grande`}
                    className="absolute inset-0 cursor-zoom-in"
                  >
                    <ImagenProducto
                      src={foto.url}
                      alt=""
                      fill
                      sizes="(min-width: 640px) 180px, 33vw"
                      className="object-cover"
                    />
                  </button>
                  {i === 0 && (
                    <span className="pointer-events-none absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold uppercase tracking-wide shadow">
                      <Star className="w-3 h-3 fill-current" /> Portada
                    </span>
                  )}

                  {!confirmando && !enCurso && (
                    <div className="absolute bottom-1.5 right-1.5 flex gap-1.5">
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={() => usarDePortada(foto.idFoto)}
                          disabled={ocupado}
                          aria-label={`Usar la foto ${i + 1} como portada`}
                          title="Usar como portada"
                          className="w-10 h-10 rounded-full bg-white/95 text-slate-700 shadow-md flex items-center justify-center hover:text-rose-600 disabled:opacity-50 cursor-pointer"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmandoId(foto.idFoto)}
                        disabled={ocupado}
                        aria-label={`Eliminar la foto ${i + 1}`}
                        title="Eliminar"
                        className="w-10 h-10 rounded-full bg-white/95 text-rose-600 shadow-md flex items-center justify-center hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Confirmación de borrado sobre la misma foto */}
                  {confirmando && !enCurso && (
                    <div
                      role="alertdialog"
                      aria-label="Confirmar eliminación"
                      className="animate-sheet-fondo-entrada absolute inset-0 bg-slate-900/80 backdrop-blur-[2px] p-2 flex flex-col items-center justify-center gap-2 text-center"
                    >
                      <p className="text-xs font-bold text-white">¿Eliminar esta foto?</p>
                      <button
                        type="button"
                        onClick={() => eliminarFoto(foto.idFoto)}
                        autoFocus
                        className="w-full min-h-10 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer"
                      >
                        Eliminar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmandoId(null)}
                        className="w-full min-h-10 rounded-lg bg-white/15 text-white text-xs font-bold hover:bg-white/25 cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}

                  {enCurso && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-rose-600 animate-spin" />
                      <span className="sr-only">Guardando</span>
                    </div>
                  )}
                </li>
              );
            })}

            {/* Fotos que se están subiendo */}
            {subiendo.map((p) => (
              <li
                key={p.id}
                className="relative aspect-[4/5] rounded-xl overflow-hidden bg-slate-100 border border-slate-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.vistaPrevia} alt="" className="w-full h-full object-cover opacity-50" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-slate-800">
                  <Loader2 className="w-6 h-6 text-rose-600 animate-spin" />
                  <span className="text-[11px] font-bold">Subiendo…</span>
                </div>
              </li>
            ))}

            {/* Agregar fotos (desde la galería o la cámara del celular) */}
            {lugaresLibres > 0 && (
              <li className="aspect-[4/5]">
                <label
                  className={`h-full w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 text-center p-2 transition ${
                    ocupado
                      ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                      : 'border-rose-300 bg-rose-50/60 text-rose-700 hover:bg-rose-100/70 cursor-pointer'
                  }`}
                >
                  <ImagePlus className="w-7 h-7" />
                  <span className="text-xs font-bold leading-tight">
                    {fotos.length === 0 ? 'Agregar fotos' : 'Agregar más'}
                  </span>
                  <span className="text-[10px] font-medium text-slate-500">
                    {fotos.length}/{maxFotos}
                  </span>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={ocupado}
                    onChange={(e) => agregarFotos(e.target.files)}
                    className="sr-only"
                    aria-label={`Agregar fotos de ${colorActivo?.nombreColor ?? 'este color'}`}
                  />
                </label>
              </li>
            )}
          </ul>

          {fotos.length === 0 && subiendo.length === 0 && (
            <p className="text-xs text-slate-500">
              Sin fotos: la tienda muestra la foto principal de la prenda para este color.
            </p>
          )}
        </div>
      )}

      {/* Mensajes de resultado (anunciados por el lector de pantalla) */}
      <div aria-live="polite" className="sticky bottom-0 mt-3 empty:hidden">
        {aviso && (
          <div
            className={`animate-sheet-fondo-entrada flex items-start gap-2 p-3 rounded-xl text-sm font-medium shadow-sm ${
              aviso.tipo === 'ok'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border border-rose-200 text-rose-900'
            }`}
          >
            {aviso.tipo === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
            )}
            {aviso.texto}
          </div>
        )}
      </div>

      <GaleriaFotos
        abierta={visor !== null}
        fotos={fotos.map((f, i) => ({
          src: f.url,
          alt: `${nombreProducto} - ${colorActivo?.nombreColor ?? ''} (foto ${i + 1} de ${fotos.length})`,
        }))}
        indiceInicial={visor ?? 0}
        onCerrar={() => setVisor(null)}
        titulo={`${nombreProducto} · ${colorActivo?.nombreColor ?? ''}`}
      />
    </BottomSheet>
  );
}
