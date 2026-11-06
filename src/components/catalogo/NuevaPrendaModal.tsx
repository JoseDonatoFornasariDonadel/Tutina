'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Tag,
  X,
  BookmarkPlus,
  Building2,
  Percent,
  Plus,
  Layers,
  Upload,
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { ColorSelector, type ColorOpcion } from '@/components/catalogo/ColorSelector';
import {
  CategoriaSelector,
  agregarCategoria,
  type CategoriaOpcion,
} from '@/components/catalogo/CategoriaSelector';
import {
  calcularPrecioNetoConDescuento,
  calcularPrecioSugerido,
} from '@/lib/services/pricing.service';
import { comprimirImagen } from '@/lib/comprimirImagen';
import { mapearTextoAColorHex, normalizarNombreColor } from '@/lib/colores';

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

interface VarianteNuevaRow {
  idTemp: string;
  codTalle: number;
  codColor: number;
  stock: number;
  imagenVariante: string;
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
  const [comprimiendoImagen, setComprimiendoImagen] = useState(false);

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

  const [listaVariantesNuevas, setListaVariantesNuevas] = useState<VarianteNuevaRow[]>([]);

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
    const talleInicial = talles[0]?.codTalle ?? 0;
    const colorInicial = coloresIniciales[0]?.codColor ?? 0;
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
        idTemp: `var-${Date.now()}-1`,
        codTalle: talleInicial,
        codColor: colorInicial,
        stock: 6,
        imagenVariante: '',
      },
    ]);
    setMostrarAltaMarcaRapida(false);
    setMostrarAltaProvRapida(false);
    setMostrarAltaDescRapida(false);
  }, [
    abierto,
    categorias,
    talles,
    coloresIniciales,
    marcasIniciales,
    temporadas,
    proveedoresIniciales,
    codProveedorPreseleccionado,
  ]);

  if (!abierto) return null;

  // Compara si dos códigos de color corresponden al mismo color (por ID o por nombre normalizado)
  const sonMismoColor = (
    codColorA: number,
    codColorB: number,
    catalogoColores: ColorOpcion[] = colores
  ): boolean => {
    if (Number(codColorA) === Number(codColorB)) return true;
    const objA = catalogoColores.find((c) => c.codColor === Number(codColorA));
    const objB = catalogoColores.find((c) => c.codColor === Number(codColorB));
    if (!objA || !objB) return false;
    return normalizarNombreColor(objA.nombreColor) === normalizarNombreColor(objB.nombreColor);
  };

  // Busca si alguna variante ya cargada con ese mismo color posee imagen subida
  const obtenerImagenPreviaPorColor = (
    filas: VarianteNuevaRow[],
    codColorBuscado: number,
    excluirIdTemp?: string,
    catalogoColores: ColorOpcion[] = colores
  ): string => {
    const coincidencia = filas.find(
      (f) =>
        f.idTemp !== excluirIdTemp &&
        f.imagenVariante &&
        f.imagenVariante.trim() !== '' &&
        sonMismoColor(f.codColor, codColorBuscado, catalogoColores)
    );
    return coincidencia?.imagenVariante || '';
  };

  const agregarElementoVarianteNueva = () => {
    setListaVariantesNuevas((prev) => {
      const sigTalle =
        talles[prev.length % Math.max(1, talles.length)]?.codTalle ?? talles[0]?.codTalle ?? 0;
      // Por defecto conserva el color de la última variante para facilitar cargar varios talles del mismo color
      const ultimaFila = prev[prev.length - 1];
      const sigColor = ultimaFila?.codColor ?? colores[0]?.codColor ?? 0;
      const imagenReutilizada = obtenerImagenPreviaPorColor(prev, sigColor);

      return [
        ...prev,
        {
          idTemp: `var-${Date.now()}-${prev.length + 1}`,
          codTalle: sigTalle,
          codColor: sigColor,
          stock: 5,
          imagenVariante: imagenReutilizada,
        },
      ];
    });
  };

  const prepararImagen = async (file: File): Promise<string | null> => {
    setComprimiendoImagen(true);
    try {
      return await comprimirImagen(file);
    } catch {
      alert('No se pudo procesar la imagen. Probá con otro archivo.');
      return null;
    } finally {
      setComprimiendoImagen(false);
    }
  };

  const handleSubirImagenVarianteNueva = async (idx: number, file?: File) => {
    if (!file) return;
    const dataUrl = await prepararImagen(file);
    if (!dataUrl) return;

    setListaVariantesNuevas((prev) => {
      const filaObjetivo = prev[idx];
      if (!filaObjetivo) return prev;
      const codColorObjetivo = filaObjetivo.codColor;

      // Asignar la imagen a esta variante y automáticamente a todas las variantes del mismo color
      return prev.map((fila, i) => {
        if (i === idx || sonMismoColor(fila.codColor, codColorObjetivo)) {
          return { ...fila, imagenVariante: dataUrl };
        }
        return fila;
      });
    });

    if (idx === 0) {
      setNuevoProdForm((prev) => ({ ...prev, imagen: dataUrl }));
    }
  };

  const handleCambioColorVariante = (idTemp: string, nuevoColorObj: ColorOpcion) => {
    const listaColoresActualizada = colores.some((c) => c.codColor === nuevoColorObj.codColor)
      ? colores
      : [...colores, nuevoColorObj];

    setListaVariantesNuevas((prev) => {
      const imagenExistenteDelNuevoColor = obtenerImagenPreviaPorColor(
        prev,
        nuevoColorObj.codColor,
        idTemp,
        listaColoresActualizada
      );

      return prev.map((row) => {
        if (row.idTemp !== idTemp) return row;
        const mismoColorQueAntes = sonMismoColor(
          row.codColor,
          nuevoColorObj.codColor,
          listaColoresActualizada
        );
        if (mismoColorQueAntes) {
          return {
            ...row,
            codColor: nuevoColorObj.codColor,
            imagenVariante: row.imagenVariante || imagenExistenteDelNuevoColor,
          };
        }
        // Si cambió a un color que ya tiene foto en otra fila, se reutiliza automáticamente;
        // si cambió a un color nuevo sin foto, se limpia para solicitar la foto del nuevo color.
        return {
          ...row,
          codColor: nuevoColorObj.codColor,
          imagenVariante: imagenExistenteDelNuevoColor,
        };
      });
    });
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (listaVariantesNuevas.length === 0) {
      alert('Agrega al menos un elemento de Talle y Color a la lista.');
      return;
    }
    setGuardando(true);
    try {
      const primeraImg = listaVariantesNuevas.find((v) => v.imagenVariante)?.imagenVariante;

      // La foto de cada color viaja una sola vez (en la primera fila de ese color). La tienda
      // y el panel la toman para todos los talles del color, así no se guarda repetida.
      const imagenesAEnviar: Record<string, string | null> = {};
      const imagenEnviadaPorColor = new Map<number, string>();
      for (const v of listaVariantesNuevas) {
        const img =
          v.imagenVariante || obtenerImagenPreviaPorColor(listaVariantesNuevas, v.codColor) || null;
        if (!img) {
          imagenesAEnviar[v.idTemp] = null;
        } else if (imagenEnviadaPorColor.get(v.codColor) === img) {
          imagenesAEnviar[v.idTemp] = null;
        } else {
          if (!imagenEnviadaPorColor.has(v.codColor)) imagenEnviadaPorColor.set(v.codColor, img);
          imagenesAEnviar[v.idTemp] = img;
        }
      }

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
      const res = await fetch('/api/catalogo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...nuevoProdForm,
          imagen: primeraImg || nuevoProdForm.imagen,
          codDescuento: nuevoProdForm.codDescuento ? Number(nuevoProdForm.codDescuento) : null,
          codProveedorHabitual: nuevoProdForm.codProveedorHabitual
            ? Number(nuevoProdForm.codProveedorHabitual)
            : null,
          variantes: listaVariantesNuevas.map((v) => ({
            codTalle: Number(v.codTalle),
            codColor: Number(v.codColor),
            // Desde una factura, el stock entra al registrar la factura
            stock: modoIngresoFactura ? 0 : Number(v.stock),
            imagenVariante: imagenesAEnviar[v.idTemp] ?? null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear producto');
      await onSuccess(data, emparejarCantidades(data as NuevoProductoCreado));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al crear producto');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto`}
    >
      <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Tag className="w-4 h-4 text-rose-400" /> Incorporar Nueva Prenda al Catálogo
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[84vh] overflow-y-auto">
          {/* Datos generales de la Prenda */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre de la Indumentaria *
              </label>
              <input
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
              <input
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
              <select
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
              <select
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
              <select
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

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Precio Costo ($)
              </label>
              <input
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
              <input
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
                  <input
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
                  <input
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
                  <input
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
                  <input
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

          {/* Lista Dinámica de Variantes: Talle, Color, Stock y Cargar Imagen (con reutilización por color) */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-rose-600" /> Lista de Talles, Colores, Stock e
                  Imágenes ({listaVariantesNuevas.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Si agregás otro talle del mismo color, la imagen subida para ese color se reutiliza
                  automáticamente. Solo necesitás subir una foto nueva cuando el color cambia.
                </p>
                {modoIngresoFactura && (
                  <p className="text-[11px] font-semibold text-indigo-700">
                    La cantidad de cada talle entra a la factura y se suma al stock recién al
                    registrarla.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={agregarElementoVarianteNueva}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition cursor-pointer shrink-0 shadow-2xs"
              >
                <Plus className="w-4 h-4" /> Agregar Talle y Color a la Lista
              </button>
            </div>

            <div className="space-y-2.5">
              {listaVariantesNuevas.map((item, idx) => {
                const colorSelObj = colores.find((c) => c.codColor === Number(item.codColor));
                const hexColorDinamico = mapearTextoAColorHex(
                  colorSelObj?.nombreColor || '',
                  colorSelObj?.codigoHex
                );

                // Determinar si una fila anterior ya tiene este mismo color con imagen cargada
                const indicePrimeraFilaMismoColor = listaVariantesNuevas.findIndex((f) =>
                  sonMismoColor(f.codColor, item.codColor)
                );
                const esColorRepetido =
                  indicePrimeraFilaMismoColor >= 0 && indicePrimeraFilaMismoColor < idx;
                const imagenEfectiva =
                  item.imagenVariante ||
                  obtenerImagenPreviaPorColor(listaVariantesNuevas, item.codColor);

                return (
                  <div
                    key={item.idTemp}
                    className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                  >
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Talle
                      </label>
                      <select
                        value={item.codTalle}
                        onChange={(e) => {
                          const copia = [...listaVariantesNuevas];
                          copia[idx] = { ...item, codTalle: Number(e.target.value) };
                          setListaVariantesNuevas(copia);
                        }}
                        className="w-full px-2.5 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white"
                      >
                        {talles.map((t) => (
                          <option key={t.codTalle} value={t.codTalle}>
                            Talle {t.nombreTalle}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center justify-between">
                        <span>Color</span>
                        {colorSelObj && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 normal-case">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-slate-300 ring-2 ring-slate-100 inline-block shadow-2xs transition-colors"
                              style={{ backgroundColor: hexColorDinamico }}
                              title={`${colorSelObj.nombreColor} (${hexColorDinamico})`}
                            />
                          </span>
                        )}
                      </label>
                      <ColorSelector
                        colores={colores}
                        value={item.codColor}
                        onCrearColor={crearColor}
                        onChange={(cObj) => handleCambioColorVariante(item.idTemp, cObj)}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        {modoIngresoFactura ? 'Cantidad que ingresa' : 'Stock (Unid.)'}
                      </label>
                      <input
                        type="number"
                inputMode="numeric"
                        min={0}
                        required
                        value={item.stock}
                        onChange={(e) => {
                          const copia = [...listaVariantesNuevas];
                          copia[idx] = { ...item, stock: Number(e.target.value) };
                          setListaVariantesNuevas(copia);
                        }}
                        className="w-full px-2.5 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Imagen de la Prenda / Color
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                          {imagenEfectiva ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imagenEfectiva}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-slate-300" />
                          )}
                        </div>

                        {esColorRepetido && imagenEfectiva ? (
                          <div className="flex-1 py-1.5 px-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 text-[11px] font-bold text-emerald-800 flex items-center justify-between gap-1 truncate">
                            <span className="inline-flex items-center gap-1 truncate">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate">Foto de {colorSelObj?.nombreColor}</span>
                            </span>
                            <label
                              className="text-[10px] text-emerald-700 underline cursor-pointer shrink-0 ml-1"
                              title="Reemplazar foto para este color"
                            >
                              Cambiar
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  handleSubirImagenVarianteNueva(idx, e.target.files?.[0])
                                }
                                className="hidden"
                              />
                            </label>
                          </div>
                        ) : (
                          <label className="flex-1 py-2 px-2.5 rounded-lg border border-dashed border-rose-300 bg-rose-50/50 text-[11px] font-bold text-rose-700 hover:bg-rose-100/60 cursor-pointer text-center truncate">
                            <Upload className="w-3 h-3 inline mr-1" />
                            {imagenEfectiva ? 'Cambiar foto' : 'Cargar foto'}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) =>
                                handleSubirImagenVarianteNueva(idx, e.target.files?.[0])
                              }
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    <div className="sm:col-span-1 flex justify-end pt-3 sm:pt-4">
                      <button
                        type="button"
                        disabled={listaVariantesNuevas.length <= 1}
                        onClick={() =>
                          setListaVariantesNuevas((prev) => prev.filter((_, i) => i !== idx))
                        }
                        title="Quitar este elemento de la lista"
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || comprimiendoImagen}
              className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {comprimiendoImagen
                ? 'Procesando foto...'
                : guardando
                ? 'Guardando...'
                : 'Guardar Nueva Prenda y sus Variantes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
