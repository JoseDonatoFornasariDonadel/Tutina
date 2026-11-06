'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Tag,
  X,
  BookmarkPlus,
  Building2,
  Percent,
  Plus,
} from 'lucide-react';
import type { ColorOpcion } from '@/components/catalogo/ColorSelector';
import { GestionFotosSheet } from '@/components/catalogo/GestionFotosSheet';
import {
  GestionVariantesSheet,
  type VarianteEditable,
} from '@/components/catalogo/GestionVariantesSheet';
import {
  TarjetasFotosVariantes,
  agruparColoresDeVariantes,
} from '@/components/catalogo/TarjetasFotosVariantes';
import { subirFotosBorrador, useGaleriaBorrador } from '@/components/catalogo/galeriaPrenda';
import {
  CategoriaSelector,
  agregarCategoria,
  type CategoriaOpcion,
} from '@/components/catalogo/CategoriaSelector';
import {
  calcularPrecioNetoConDescuento,
  calcularPrecioSugerido,
} from '@/lib/services/pricing.service';
import { Stepper, PieStepper, esPantallaChica } from '@/components/mobile/Stepper';
import { mapearTextoAColorHex } from '@/lib/colores';

export interface NuevaPrendaVarianteCreada {
  codVariante: number;
  sku: string;
  stock: number;
  imagenVariante?: string | null;
  codProducto: number;
  codTalle: number;
  codColor: number;
  talle: { codTalle: number; nombreTalle: string };
  color: { codColor: number; nombreColor: string; codigoHex: string };
}

export interface NuevoProductoCreado {
  codProducto: number;
  nombre: string;
  descripcion: string;
  imagen: string;
  precioCosto: number;
  porcentajeMarkup: number;
  precio: number;
  codMarca: number;
  codCategoria: number;
  codDescuento: number | null;
  codProveedorHabitual: number | null;
  marca: { codMarca: number; nombreMarca: string };
  categoria: {
    codCategoria: number;
    nombreCategoria: string;
    rubro?: string;
    markupPorDefectoCategoria?: number;
  };
  variantes: NuevaPrendaVarianteCreada[];
}


/** Cantidad cargada en el formulario para cada variante creada (por codVariante). */
export type CantidadesPorVariante = Record<number, number>;

interface NuevaPrendaModalProps {
  abierto: boolean;
  onClose: () => void;
  onSuccess: (
    productoCreado: NuevoProductoCreado,
    cantidadesPorVariante: CantidadesPorVariante
  ) => void | Promise<void>;
  /**
   * Prenda creada desde una factura de proveedor: las variantes se guardan con stock 0 y
   * la cantidad cargada se informa en onSuccess para que entre con la factura (si no, el
   * stock se sumaría dos veces: al crear la prenda y al registrar la factura).
   */
  modoIngresoFactura?: boolean;
  /** Avisa a la pantalla que abrió el modal que se creó una categoría (para sus filtros). */
  onCategoriaCreada?: (categoria: CategoriaOpcion) => void;
  marcasIniciales: { codMarca: number; nombreMarca: string }[];
  categorias: {
    codCategoria: number;
    nombreCategoria: string;
    markupPorDefectoCategoria?: number;
  }[];
  temporadas: { codTemporada: number; nombreTemporada: string }[];
  descuentosIniciales: {
    codDescuento: number;
    nombreDesc: string;
    porcentajeDesc: number;
    fechaInicioDesc: string;
    fechaFinDesc: string;
  }[];
  proveedoresIniciales: { codProveedor: number; nombreProveedor: string }[];
  talles: { codTalle: number; nombreTalle: string }[];
  coloresIniciales: ColorOpcion[];
  codProveedorPreseleccionado?: number;
  /** Clase z-index para permitir apilar este modal sobre otros modales (ej: z-[60]) */
  zIndexClass?: string;
}

export function NuevaPrendaModal({
  abierto,
  onClose,
  onSuccess,
  marcasIniciales,
  categorias,
  temporadas,
  descuentosIniciales,
  proveedoresIniciales,
  talles,
  coloresIniciales,
  codProveedorPreseleccionado,
  zIndexClass = 'z-50',
  modoIngresoFactura = false,
  onCategoriaCreada,
}: NuevaPrendaModalProps) {
  // Lista propia para que una categoría creada desde el selector aparezca al instante
  const [categoriasLocales, setCategoriasLocales] = useState<CategoriaOpcion[]>(categorias);
  useEffect(() => {
    setCategoriasLocales(categorias);
  }, [categorias]);
  const [marcas, setMarcas] = useState(marcasIniciales);
  const [descuentos, setDescuentos] = useState(descuentosIniciales);
  const [proveedores, setProveedores] = useState(proveedoresIniciales);
  const [colores, setColores] = useState<ColorOpcion[]>(coloresIniciales);

  useEffect(() => {
    setMarcas(marcasIniciales);
  }, [marcasIniciales]);

  useEffect(() => {
    setDescuentos(descuentosIniciales);
  }, [descuentosIniciales]);

  useEffect(() => {
    setProveedores(proveedoresIniciales);
  }, [proveedoresIniciales]);

  useEffect(() => {
    setColores(coloresIniciales);
  }, [coloresIniciales]);

  const [guardando, setGuardando] = useState(false);
  // Al crear: progreso de la subida de fotos (la prenda ya existe en ese momento)
  const [progresoFotos, setProgresoFotos] = useState<{ actual: number; total: number } | null>(
    null
  );

  // Sub-formularios rápidos al vuelo
  const [mostrarAltaMarcaRapida, setMostrarAltaMarcaRapida] = useState(false);
  const [nombreMarcaRapida, setNombreMarcaRapida] = useState('');
  const [mostrarAltaProvRapida, setMostrarAltaProvRapida] = useState(false);
  const [nuevoProvRapido, setNuevoProvRapido] = useState({
    nombreProveedor: '',
    numeroProveedor: '+54911',
  });
  const [mostrarAltaDescRapida, setMostrarAltaDescRapida] = useState(false);
  const [nuevoDescRapido, setNuevoDescRapido] = useState(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const enUnMes = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return {
      nombreDesc: '',
      porcentajeDesc: 15,
      fechaInicioDesc: hoy,
      fechaFinDesc: enUnMes,
    };
  });

  const [nuevoProdForm, setNuevoProdForm] = useState({
    nombre: '',
    descripcion: '',
    imagen:
      'https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=800&q=80',
    precioCosto: 12000,
    porcentajeMarkup: 125,
    precio: 27000,
    codMarca: 0,
    codCategoria: 0,
    codTemporada: 0,
    codDescuento: '',
    codProveedorHabitual: '',
  });

  // Borrador de la prenda (todavía no tiene ID): variantes y fotos por color en memoria.
  // Se insertan en la base recién al tocar «Guardar prenda».
  const [listaVariantesNuevas, setListaVariantesNuevas] = useState<VarianteEditable[]>([]);
  const {
    galeria: galeriaBorrador,
    acciones: accionesBorrador,
    reiniciar: reiniciarGaleria,
    fotosPorColor,
  } = useGaleriaBorrador(colores);
  // Paneles de fotos y de variantes (bottom sheet en celular, ventana en escritorio)
  const [panelFotos, setPanelFotos] = useState<{ codColor?: number } | null>(null);
  const [panelVariantes, setPanelVariantes] = useState(false);

  // En celular el formulario se recorre en pasos; en escritorio se ve completo
  const [paso, setPaso] = useState(0);
  const contenedorRef = useRef<HTMLDivElement>(null);

  // Si el modal se abrió antes de que llegaran los datos, completar categoría y marca
  useEffect(() => {
    if (!abierto) return;
    setNuevoProdForm((prev) => {
      if (prev.codCategoria && prev.codMarca) return prev;
      const cat = prev.codCategoria ? null : categorias[0];
      const codMarca = prev.codMarca || marcasIniciales[0]?.codMarca || 0;
      if (!cat && codMarca === prev.codMarca) return prev;
      const mk = cat?.markupPorDefectoCategoria ?? prev.porcentajeMarkup;
      return {
        ...prev,
        codMarca,
        ...(cat
          ? {
              codCategoria: cat.codCategoria,
              porcentajeMarkup: mk,
              precio: calcularPrecioSugerido(prev.precioCosto, mk),
            }
          : {}),
      };
    });
  }, [abierto, categorias, marcasIniciales]);

  // Inicializar el formulario cada vez que se abre el modal. Solo al abrirlo: si la
  // pantalla actualiza sus listas (por ejemplo, una categoría creada desde acá), el
  // formulario no se borra.
  const estabaAbierto = useRef(false);
  useEffect(() => {
    const recienAbierto = abierto && !estabaAbierto.current;
    estabaAbierto.current = abierto;
    if (!recienAbierto) return;
    const mkInicial = categorias[0]?.markupPorDefectoCategoria ?? 125;
    const talleInicial = talles[0];
    const colorInicial = coloresIniciales[0];
    const provDefecto =
      codProveedorPreseleccionado && codProveedorPreseleccionado > 0
        ? String(codProveedorPreseleccionado)
        : proveedoresIniciales[0]?.codProveedor
        ? String(proveedoresIniciales[0].codProveedor)
        : '';

    setNuevoProdForm({
      nombre: '',
      descripcion: '',
      imagen:
        'https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=800&q=80',
      precioCosto: 12000,
      porcentajeMarkup: mkInicial,
      precio: calcularPrecioSugerido(12000, mkInicial),
      codMarca: marcasIniciales[0]?.codMarca ?? 0,
      codCategoria: categorias[0]?.codCategoria ?? 0,
      codTemporada: temporadas[0]?.codTemporada ?? 0,
      codDescuento: '',
      codProveedorHabitual: provDefecto,
    });

    setListaVariantesNuevas([
      {
        codTalle: talleInicial?.codTalle ?? 0,
        codColor: colorInicial?.codColor ?? 0,
        stock: 6,
        talle: talleInicial,
        color: colorInicial,
      },
    ]);
    reiniciarGaleria();
    setPanelFotos(null);
    setPanelVariantes(false);
    setMostrarAltaMarcaRapida(false);
    setMostrarAltaProvRapida(false);
    setMostrarAltaDescRapida(false);
    setPaso(0);
  }, [
    abierto,
    categorias,
    talles,
    coloresIniciales,
    marcasIniciales,
    temporadas,
    proveedoresIniciales,
    codProveedorPreseleccionado,
    reiniciarGaleria,
  ]);

  // Colores de la prenda nueva con sus talles (comparten las fotos)
  const coloresBorrador = useMemo(
    () => agruparColoresDeVariantes(listaVariantesNuevas, colores, talles),
    [listaVariantesNuevas, colores, talles]
  );

  if (!abierto) return null;

  const crearColor = async (nombreColor: string, codigoHex: string): Promise<ColorOpcion> => {
    const hexMapeado = mapearTextoAColorHex(nombreColor, codigoHex);
    const res = await fetch('/api/catalogo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipoAlta: 'COLOR', nombreColor, codigoHex: hexMapeado }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo crear el color');
    const nuevo: ColorOpcion = {
      codColor: data.codColor,
      nombreColor: data.nombreColor,
      codigoHex: mapearTextoAColorHex(data.nombreColor, data.codigoHex),
    };
    setColores((prev) =>
      prev.some((c) => c.codColor === nuevo.codColor) ? prev : [...prev, nuevo]
    );
    return nuevo;
  };

  const handleCrearMarcaAlVuelo = async () => {
    if (!nombreMarcaRapida.trim()) return;
    const res = await fetch('/api/catalogo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipoAlta: 'MARCA',
        nombreMarca: nombreMarcaRapida.trim(),
      }),
    });
    const data = await res.json();
    if (res.ok && data.codMarca) {
      setMarcas((prev) => [...prev, data]);
      setNuevoProdForm((prev) => ({ ...prev, codMarca: data.codMarca }));
      setNombreMarcaRapida('');
      setMostrarAltaMarcaRapida(false);
    }
  };

  const handleCrearProveedorAlVuelo = async () => {
    if (!nuevoProvRapido.nombreProveedor || !nuevoProvRapido.numeroProveedor) return;
    const res = await fetch('/api/proveedores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'PROVEEDOR',
        ...nuevoProvRapido,
      }),
    });
    const data = await res.json();
    if (res.ok && data.codProveedor) {
      setProveedores((prev) => [...prev, data]);
      setNuevoProdForm((prev) => ({
        ...prev,
        codProveedorHabitual: String(data.codProveedor),
      }));
      setNuevoProvRapido({ nombreProveedor: '', numeroProveedor: '+54911' });
      setMostrarAltaProvRapida(false);
    }
  };

  const handleCrearDescuentoAlVuelo = async () => {
    if (!nuevoDescRapido.nombreDesc.trim() || Number(nuevoDescRapido.porcentajeDesc) <= 0) return;
    const res = await fetch('/api/catalogo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipoAlta: 'DESCUENTO',
        nombreDesc: nuevoDescRapido.nombreDesc.trim(),
        descripcionDesc: `${nuevoDescRapido.porcentajeDesc}% OFF`,
        porcentajeDesc: Number(nuevoDescRapido.porcentajeDesc),
        fechaInicioDesc: nuevoDescRapido.fechaInicioDesc,
        fechaFinDesc: nuevoDescRapido.fechaFinDesc,
      }),
    });
    const data = await res.json();
    if (res.ok && data.codDescuento) {
      setDescuentos((prev) => [...prev, data]);
      setNuevoProdForm((prev) => ({
        ...prev,
        codDescuento: String(data.codDescuento),
      }));
      setNuevoDescRapido((prev) => ({ ...prev, nombreDesc: '', porcentajeDesc: 15 }));
      setMostrarAltaDescRapida(false);
    }
  };

  const PASOS = [{ titulo: 'Datos' }, { titulo: 'Precio' }, { titulo: 'Fotos y talles' }];
  const ULTIMO_PASO = PASOS.length - 1;

  // Los campos de los pasos ocultos no se pueden validar con el navegador
  // (están con display:none), así que se revisan al avanzar.
  const validarPaso = (n: number): boolean => {
    if (n === 0 && !nuevoProdForm.nombre.trim()) {
      alert('Ingresá el nombre de la prenda.');
      return false;
    }
    if (n === 1 && (!(nuevoProdForm.precioCosto > 0) || !(nuevoProdForm.precio > 0))) {
      alert('Revisá el precio de costo y el precio de venta.');
      return false;
    }
    return true;
  };

  const irAPaso = (destino: number) => {
    const n = Math.max(0, Math.min(ULTIMO_PASO, destino));
    // Para avanzar hay que completar los pasos intermedios; retroceder siempre se puede
    for (let i = paso; i < n; i++) {
      if (!validarPaso(i)) {
        setPaso(i);
        return;
      }
    }
    setPaso(n);
    contenedorRef.current?.scrollTo({ top: 0 });
  };

  // En móvil cada paso muestra solo su sección; desde sm se ve todo
  const visibleEnPaso = (n: number) => (paso === n ? '' : 'max-sm:hidden');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // "Ir" en el teclado del celular envía el formulario: en pasos intermedios, avanza
    if (esPantallaChica() && paso < ULTIMO_PASO) {
      irAPaso(paso + 1);
      return;
    }
    if (!validarPaso(0) || !validarPaso(1)) {
      setPaso(!nuevoProdForm.nombre.trim() ? 0 : 1);
      return;
    }
    if (listaVariantesNuevas.length === 0) {
      alert('Agrega al menos un elemento de Talle y Color a la lista.');
      return;
    }
    setGuardando(true);
    try {
      // Relaciona cada variante creada con la fila del formulario (mismo talle y color, en orden)
      const emparejarCantidades = (prod: NuevoProductoCreado): CantidadesPorVariante => {
        const usadas = new Set<number>();
        const cantidades: CantidadesPorVariante = {};
        for (const fila of listaVariantesNuevas) {
          const creada = [...(prod.variantes || [])]
            .sort((a, b) => a.codVariante - b.codVariante)
            .find(
              (v) =>
                !usadas.has(v.codVariante) &&
                v.codTalle === Number(fila.codTalle) &&
                v.codColor === Number(fila.codColor)
            );
          if (creada) {
            usadas.add(creada.codVariante);
            cantidades[creada.codVariante] = Math.max(0, Number(fila.stock) || 0);
          }
        }
        return cantidades;
      };

      // Solo se guardan las fotos de los colores que tienen talles
      const coloresConTalles = new Set(coloresBorrador.map((c) => c.codColor));
      const hayFotos = Object.entries(fotosPorColor).some(
        ([cod, fotos]) => fotos.length > 0 && coloresConTalles.has(Number(cod))
      );

      // 1) Se crea la prenda con sus variantes (sin fotos: no entrarían en una sola petición)
      const res = await fetch('/api/catalogo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...nuevoProdForm,
          // La foto principal sale de la primera foto que se suba
          imagen: hayFotos ? '' : nuevoProdForm.imagen,
          fotosPendientes: hayFotos,
          codDescuento: nuevoProdForm.codDescuento ? Number(nuevoProdForm.codDescuento) : null,
          codProveedorHabitual: nuevoProdForm.codProveedorHabitual
            ? Number(nuevoProdForm.codProveedorHabitual)
            : null,
          variantes: listaVariantesNuevas.map((v) => ({
            codTalle: Number(v.codTalle),
            codColor: Number(v.codColor),
            // Desde una factura, el stock entra al registrar la factura
            stock: modoIngresoFactura ? 0 : Number(v.stock),
            imagenVariante: null,
          })),
        }),
      });
      const data = (await res.json()) as NuevoProductoCreado & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Error al crear producto');

      // 2) Con la prenda creada, las fotos del borrador pasan a su galería (de a una)
      if (hayFotos) {
        const resultado = await subirFotosBorrador(
          data.codProducto,
          fotosPorColor,
          coloresConTalles,
          (actual, total) => setProgresoFotos({ actual, total })
        );
        // La pantalla que abrió el formulario ve las portadas sin volver a pedir la prenda
        const portadaPorColor = new Map(
          Object.entries(fotosPorColor)
            .filter(([, fotos]) => fotos.length > 0)
            .map(([cod, fotos]) => [Number(cod), fotos[0].url])
        );
        if (resultado.subidas > 0) {
          data.variantes = data.variantes.map((v) => ({
            ...v,
            imagenVariante: portadaPorColor.get(v.codColor) ?? v.imagenVariante ?? null,
          }));
          data.imagen =
            portadaPorColor.get(data.variantes[0]?.codColor) ??
            [...portadaPorColor.values()][0] ??
            data.imagen;
        }
        if (resultado.fallidas > 0) {
          alert(
            `La prenda se creó, pero ${resultado.fallidas} foto(s) no se guardaron` +
              (resultado.error ? `: ${resultado.error}` : '.') +
              ' Podés agregarlas desde «Editar prenda» › «Gestionar fotos».'
          );
        }
      }

      await onSuccess(data, emparejarCantidades(data));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al crear producto');
    } finally {
      setGuardando(false);
      setProgresoFotos(null);
    }
  };

  return (
    <div
      ref={contenedorRef}
      className={`fixed inset-0 ${zIndexClass} bg-slate-900/60 backdrop-blur-xs flex items-start sm:items-center justify-center sm:p-4 overflow-y-auto scroll-touch`}
    >
      <div role="dialog" aria-modal="true" aria-label="Nueva prenda" className="bg-white sm:rounded-2xl max-w-3xl w-full min-h-dvh sm:min-h-0 border-slate-200 sm:border shadow-2xl sm:overflow-hidden sm:my-8 flex flex-col">
        <div className="sticky top-0 z-10 sm:static px-4 sm:px-6 pt-safe bg-slate-900 text-white">
          <div className="min-h-14 py-2 sm:py-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold flex items-center gap-2 min-w-0">
              <Tag className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="truncate">
                <span className="sm:hidden">Nueva prenda</span>
                <span className="hidden sm:inline">Incorporar Nueva Prenda al Catálogo</span>
              </span>
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="touch-target -mr-2 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col px-4 pt-4 sm:p-6 space-y-5 sm:max-h-[84vh] sm:overflow-y-auto"
        >
          <Stepper pasos={PASOS} pasoActual={paso} onIrAPaso={irAPaso} />

          {/* Paso 1: datos generales de la prenda */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3.5 ${visibleEnPaso(0)}`}>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre de la Indumentaria *
              </label>
              <input aria-label="Nombre de la Indumentaria"
                type="text"
                required
                placeholder="Ej: Calza Deportiva Seamless Texturada"
                value={nuevoProdForm.nombre}
                onChange={(e) => setNuevoProdForm({ ...nuevoProdForm, nombre: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Descripción de la Prenda
              </label>
              <input aria-label="Descripción de la Prenda"
                type="text"
                placeholder="Ej: Tejido elastizado tiro alto..."
                value={nuevoProdForm.descripcion}
                onChange={(e) =>
                  setNuevoProdForm({ ...nuevoProdForm, descripcion: e.target.value })
                }
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Categoría</label>
              <CategoriaSelector
                categorias={categoriasLocales}
                value={nuevoProdForm.codCategoria}
                onChange={(cat) => {
                  const mk = cat.markupPorDefectoCategoria ?? 120;
                  // Actualización funcional: la categoría nueva llega después de un await
                  setNuevoProdForm((prev) => ({
                    ...prev,
                    codCategoria: cat.codCategoria,
                    porcentajeMarkup: mk,
                    precio: calcularPrecioSugerido(prev.precioCosto, mk),
                  }));
                }}
                onCategoriaCreada={(cat) => {
                  setCategoriasLocales((prev) => agregarCategoria(prev, cat));
                  onCategoriaCreada?.(cat);
                }}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Marca</label>
                <button
                  type="button"
                  onClick={() => setMostrarAltaMarcaRapida(!mostrarAltaMarcaRapida)}
                  className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer flex items-center gap-0.5"
                >
                  <BookmarkPlus className="w-3 h-3" /> + Nueva Marca
                </button>
              </div>
              <select aria-label="Marca"
                value={nuevoProdForm.codMarca}
                onChange={(e) =>
                  setNuevoProdForm({ ...nuevoProdForm, codMarca: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white"
              >
                {marcas.map((m) => (
                  <option key={m.codMarca} value={m.codMarca}>
                    {m.nombreMarca}
                  </option>
                ))}
              </select>
            </div>

            {mostrarAltaMarcaRapida && (
              <div className="sm:col-span-2 p-3 rounded-xl bg-rose-50/70 border border-rose-200 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Nombre de la nueva marca *"
                  value={nombreMarcaRapida}
                  onChange={(e) => setNombreMarcaRapida(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                />
                <button
                  type="button"
                  onClick={handleCrearMarcaAlVuelo}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer"
                >
                  Guardar Marca
                </button>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Temporada</label>
              <select aria-label="Temporada"
                value={nuevoProdForm.codTemporada}
                onChange={(e) =>
                  setNuevoProdForm({ ...nuevoProdForm, codTemporada: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white"
              >
                {temporadas.map((t) => (
                  <option key={t.codTemporada} value={t.codTemporada}>
                    {t.nombreTemporada}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Proveedor Habitual</label>
                <button
                  type="button"
                  onClick={() => setMostrarAltaProvRapida(!mostrarAltaProvRapida)}
                  className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer flex items-center gap-0.5"
                >
                  <Building2 className="w-3 h-3" /> + Nuevo Proveedor
                </button>
              </div>
              <select aria-label="Proveedor Habitual"
                value={nuevoProdForm.codProveedorHabitual}
                onChange={(e) =>
                  setNuevoProdForm({ ...nuevoProdForm, codProveedorHabitual: e.target.value })
                }
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white"
              >
                <option value="">Sin especificar</option>
                {proveedores.map((pr) => (
                  <option key={pr.codProveedor} value={pr.codProveedor}>
                    {pr.nombreProveedor}
                  </option>
                ))}
              </select>
            </div>

            {mostrarAltaProvRapida && (
              <div className="sm:col-span-2 p-3 rounded-xl bg-rose-50/70 border border-rose-200 grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                <input
                  type="text"
                  placeholder="Nombre Proveedor *"
                  value={nuevoProvRapido.nombreProveedor}
                  onChange={(e) =>
                    setNuevoProvRapido({ ...nuevoProvRapido, nombreProveedor: e.target.value })
                  }
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                />
                <input
                  type="text"
                  placeholder="WhatsApp *"
                  value={nuevoProvRapido.numeroProveedor}
                  onChange={(e) =>
                    setNuevoProvRapido({ ...nuevoProvRapido, numeroProveedor: e.target.value })
                  }
                  className="px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white"
                />
                <button
                  type="button"
                  onClick={handleCrearProveedorAlVuelo}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer"
                >
                  Guardar Proveedor
                </button>
              </div>
            )}
          </div>

          {/* Paso 2: precio y descuento */}
          <div className={`space-y-5 ${visibleEnPaso(1)}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Precio Costo ($)
              </label>
              <input aria-label="Precio Costo ($)"
                type="number"
                inputMode="decimal"
                required
                value={nuevoProdForm.precioCosto}
                onChange={(e) => {
                  const costo = Number(e.target.value);
                  setNuevoProdForm({
                    ...nuevoProdForm,
                    precioCosto: costo,
                    precio: calcularPrecioSugerido(costo, nuevoProdForm.porcentajeMarkup),
                  });
                }}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-indigo-700 mb-1">
                Markup (%)
              </label>
              <input aria-label="Markup (%)"
                type="number"
                inputMode="decimal"
                required
                value={nuevoProdForm.porcentajeMarkup}
                onChange={(e) => {
                  const mk = Number(e.target.value);
                  setNuevoProdForm({
                    ...nuevoProdForm,
                    porcentajeMarkup: mk,
                    precio: calcularPrecioSugerido(nuevoProdForm.precioCosto, mk),
                  });
                }}
                className="w-full px-3 py-2 text-sm font-bold text-indigo-700 rounded-xl border border-indigo-200"
              />
            </div>

            <div className="sm:col-span-2 bg-emerald-50 p-3 rounded-xl border border-emerald-200 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900">
                Precio de Venta Calculado ($):
              </span>
              <input
                type="number"
                inputMode="decimal"
                required
                value={nuevoProdForm.precio}
                onChange={(e) =>
                  setNuevoProdForm({ ...nuevoProdForm, precio: Number(e.target.value) })
                }
                className="w-36 px-3 py-1.5 text-sm font-extrabold text-emerald-800 bg-white rounded-lg border border-emerald-300 text-right"
              />
            </div>
          </div>

          {/* Recuadro de Descuento Promocional en Nueva Prenda */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Percent className="w-4 h-4 text-rose-600" /> Descuento Promocional (Opcional)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Selecciona un descuento existente para esta nueva prenda o crea uno nuevo.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMostrarAltaDescRapida(!mostrarAltaDescRapida)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-rose-300 text-rose-700 text-xs font-bold hover:bg-rose-50 transition cursor-pointer shrink-0 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                {mostrarAltaDescRapida ? 'Cancelar nuevo' : 'Crear nuevo descuento'}
              </button>
            </div>

            {mostrarAltaDescRapida && (
              <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-bold uppercase text-rose-900 mb-1">
                    Nombre del Descuento *
                  </label>
                  <input aria-label="Nombre del Descuento"
                    type="text"
                    placeholder="Ej: Promo Lanzamiento"
                    value={nuevoDescRapido.nombreDesc}
                    onChange={(e) =>
                      setNuevoDescRapido({ ...nuevoDescRapido, nombreDesc: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase text-rose-900 mb-1">
                    % OFF *
                  </label>
                  <input aria-label="% OFF"
                    type="number"
                inputMode="decimal"
                    min={1}
                    max={90}
                    value={nuevoDescRapido.porcentajeDesc}
                    onChange={(e) =>
                      setNuevoDescRapido({
                        ...nuevoDescRapido,
                        porcentajeDesc: Number(e.target.value),
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase text-rose-900 mb-1">
                    Desde
                  </label>
                  <input aria-label="Desde"
                    type="date"
                    value={nuevoDescRapido.fechaInicioDesc}
                    onChange={(e) =>
                      setNuevoDescRapido({
                        ...nuevoDescRapido,
                        fechaInicioDesc: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase text-rose-900 mb-1">
                    Hasta
                  </label>
                  <input aria-label="Hasta"
                    type="date"
                    value={nuevoDescRapido.fechaFinDesc}
                    onChange={(e) =>
                      setNuevoDescRapido({ ...nuevoDescRapido, fechaFinDesc: e.target.value })
                    }
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleCrearDescuentoAlVuelo}
                    className="w-full py-1.5 px-3 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer"
                  >
                    Guardar Promo
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <select
                value={nuevoProdForm.codDescuento}
                onChange={(e) =>
                  setNuevoProdForm({ ...nuevoProdForm, codDescuento: e.target.value })
                }
                className="w-full px-3 py-2 text-xs sm:text-sm font-medium rounded-xl border border-slate-300 bg-white"
              >
                <option value="">✓ Sin descuento aplicado (Precio de Lista Completo)</option>
                {descuentos.map((d) => (
                  <option key={d.codDescuento} value={d.codDescuento}>
                    {d.nombreDesc} (-{d.porcentajeDesc}% OFF)
                  </option>
                ))}
              </select>

              {(() => {
                const descSel = descuentos.find(
                  (d) => String(d.codDescuento) === String(nuevoProdForm.codDescuento)
                );
                const pct = descSel ? descSel.porcentajeDesc : 0;
                const finalConDesc = calcularPrecioNetoConDescuento(nuevoProdForm.precio, pct);
                return (
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600">Precio Final Cliente:</span>
                    {pct > 0 ? (
                      <div className="text-right">
                        <span className="line-through text-slate-400 mr-1.5">
                          ${nuevoProdForm.precio.toLocaleString('es-AR')}
                        </span>
                        <span className="text-sm font-extrabold text-rose-600">
                          ${finalConDesc.toLocaleString('es-AR')} (-{pct}%)
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm font-extrabold text-emerald-700">
                        ${nuevoProdForm.precio.toLocaleString('es-AR')} (Sin descuento)
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          </div>

          {/* Paso 3: fotos (por color) y variantes, cada una en su propio panel */}
          <div className={`space-y-2 ${visibleEnPaso(2)}`}>
            <TarjetasFotosVariantes
              colores={coloresBorrador}
              variantes={listaVariantesNuevas}
              galeria={galeriaBorrador}
              onGestionarFotos={() => setPanelFotos({})}
              onGestionarVariantes={() => setPanelVariantes(true)}
              avisarStockBajo={!modoIngresoFactura}
              textoUnidades={modoIngresoFactura ? 'a ingresar' : 'en stock'}
            />
            <p className="text-[11px] text-slate-500">
              Las fotos de un color se comparten entre todos sus talles. Todo se guarda al tocar
              «Guardar prenda».
              {modoIngresoFactura &&
                ' La cantidad de cada talle entra a la factura y se suma al stock recién al registrarla.'}
            </p>
          </div>

          <div className="flex-1 sm:hidden" />
          <PieStepper
            pasoActual={paso}
            totalPasos={PASOS.length}
            onAtras={() => irAPaso(paso - 1)}
            onSiguiente={() => irAPaso(paso + 1)}
            onCancelar={onClose}
            deshabilitado={guardando}
            textoFinal={
              progresoFotos
                ? `Subiendo fotos ${progresoFotos.actual}/${progresoFotos.total}…`
                : guardando
                  ? 'Guardando...'
                  : 'Guardar prenda'
            }
          />

          <div className="hidden sm:flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {progresoFotos
                ? `Subiendo fotos ${progresoFotos.actual} de ${progresoFotos.total}…`
                : guardando
                  ? 'Guardando...'
                  : 'Guardar Nueva Prenda y sus Variantes'}
            </button>
          </div>
        </form>
      </div>

      {/* Paneles del borrador: los mismos que en «Editar prenda», en modo creación */}
      <GestionFotosSheet
        abierto={panelFotos !== null}
        onCerrar={() => setPanelFotos(null)}
        acciones={accionesBorrador}
        nombreProducto={nuevoProdForm.nombre.trim() || 'Nueva prenda'}
        colores={coloresBorrador}
        galeria={galeriaBorrador}
        cargando={false}
        error={null}
        faltaActualizarBase={false}
        onReintentar={() => {}}
        codColorInicial={panelFotos?.codColor}
        zIndexClass={zIndexClass}
      />
      <GestionVariantesSheet
        abierto={panelVariantes}
        onCerrar={() => setPanelVariantes(false)}
        modo="creacion"
        nombreProducto={nuevoProdForm.nombre.trim() || 'Nueva prenda'}
        variantes={listaVariantesNuevas}
        onCambiar={setListaVariantesNuevas}
        originales={[]}
        talles={talles}
        colores={colores}
        onCrearColor={crearColor}
        galeria={galeriaBorrador}
        onGestionarFotos={(codColor) => {
          setPanelVariantes(false);
          setPanelFotos({ codColor });
        }}
        etiquetaStock={modoIngresoFactura ? 'Cantidad que ingresa' : 'Stock'}
        avisarStockBajo={!modoIngresoFactura}
        zIndexClass={zIndexClass}
      />
    </div>
  );
}
