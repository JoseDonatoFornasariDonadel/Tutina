'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Search,
  Edit3,
  Tag,
  Plus,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  Percent,
  Layers,
  Sparkles,
  X,
  RefreshCw,
  Trash2,
  Building2,
  BookmarkPlus,
  Upload,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  EyeOff,
} from 'lucide-react';
import { ColorSelector, type ColorOpcion } from '@/components/catalogo/ColorSelector';
import {
  CategoriaSelector,
  agregarCategoria,
  type CategoriaOpcion,
} from '@/components/catalogo/CategoriaSelector';
import { NuevaPrendaModal } from '@/components/catalogo/NuevaPrendaModal';
import { mapearTextoAColorHex } from '@/lib/colores';
import {
  calcularCoeficienteReventa,
  calcularMarkupReverso,
  calcularPrecioNetoConDescuento,
  calcularPrecioSugerido,
  obtenerPorcentajeDescuentoVigente,
} from '@/lib/services/pricing.service';
import { useAppConfig } from '@/components/layout/AppShell';
import { comprimirImagen } from '@/lib/comprimirImagen';

const PRENDAS_POR_PAGINA = 12;

interface Variante {
  codVariante?: number;
  sku?: string;
  stock: number;
  alertaStockEnviada?: boolean;
  imagenVariante?: string | null;
  codTalle?: number;
  codColor?: number;
  talle?: { codTalle: number; nombreTalle: string };
  color?: { codColor: number; nombreColor: string; codigoHex: string };
}

interface DescuentoItem {
  codDescuento: number;
  nombreDesc: string;
  porcentajeDesc: number;
  fechaInicioDesc: string;
  fechaFinDesc: string;
}

interface MarcaItem {
  codMarca: number;
  nombreMarca: string;
  productos?: { codProducto: number; nombre: string }[];
}

interface ProductoCat {
  codProducto: number;
  nombre: string;
  descripcion: string;
  imagen: string;
  precioCosto: number;
  porcentajeMarkup: number;
  precio: number;
  visibleEnTiendaOnline: boolean;
  codMarca: number;
  codCategoria: number;
  codDescuento: number | null;
  codProveedorHabitual: number | null;
  marca: { codMarca: number; nombreMarca: string };
  categoria: {
    codCategoria: number;
    nombreCategoria: string;
    rubro: string;
    markupPorDefectoCategoria: number;
  };
  descuento?: DescuentoItem | null;
  proveedorHabitual?: { codProveedor: number; nombreProveedor: string } | null;
  productosTemporada: { temporada: { codTemporada: number; nombreTemporada: string } }[];
  variantes: Required<
    Pick<Variante, 'codVariante' | 'sku' | 'stock' | 'alertaStockEnviada' | 'talle' | 'color'>
  > &
    Variante[];
}

export default function CatalogoPage() {
  const { refreshGlobalState } = useAppConfig();
  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState<ProductoCat[]>([]);
  const [marcas, setMarcas] = useState<MarcaItem[]>([]);
  const [categorias, setCategorias] = useState<
    { codCategoria: number; nombreCategoria: string; markupPorDefectoCategoria: number }[]
  >([]);
  const [temporadas, setTemporadas] = useState<{ codTemporada: number; nombreTemporada: string }[]>(
    []
  );
  const [descuentos, setDescuentos] = useState<DescuentoItem[]>([]);
  const [proveedores, setProveedores] = useState<
    { codProveedor: number; nombreProveedor: string }[]
  >([]);
  const [talles, setTalles] = useState<{ codTalle: number; nombreTalle: string }[]>([]);
  const [colores, setColores] = useState<
    { codColor: number; nombreColor: string; codigoHex: string }[]
  >([]);

  // Paginación del lado del servidor (12 prendas por página)
  const [paginaActual, setPaginaActual] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filtros y Orden por Antigüedad
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS');
  const [filtroMarca, setFiltroMarca] = useState<string>('TODAS');
  const [filtroTemporada, setFiltroTemporada] = useState<string>('TODAS');
  const [ordenAntiguedad, setOrdenAntiguedad] = useState<'MAS_RECIENTES' | 'MAS_ANTIGUAS'>(
    'MAS_RECIENTES'
  );

  // Apartado de Gestión de Marcas
  const [mostrarApartadoMarcas, setMostrarApartadoMarcas] = useState(false);
  const [nuevaMarcaNombre, setNuevaMarcaNombre] = useState('');
  const [guardandoMarca, setGuardandoMarca] = useState(false);
  const [marcaEditando, setMarcaEditando] = useState<MarcaItem | null>(null);

  // Alta rápida de Marca o Proveedor dentro de los modales
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

  // Producto seleccionado para edición
  const [productoEditando, setProductoEditando] = useState<ProductoCat | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [notificacion, setNotificacion] = useState<{ tipo: 'ok' | 'alerta'; texto: string } | null>(
    null
  );

  // Modal de Nueva Prenda y su Lista Dinámica de Variantes (Talle, Color, Stock e Imagen)
  const [modalNuevoProd, setModalNuevoProd] = useState(false);

  const cargarCatalogo = useCallback(
    async (pageToFetch: number = paginaActual) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(pageToFetch),
          limit: String(PRENDAS_POR_PAGINA),
          q: busqueda.trim(),
          codCategoria: filtroCategoria,
          codMarca: filtroMarca,
          codTemporada: filtroTemporada,
          ordenAntiguedad,
        });

        const res = await fetch(`/api/catalogo?${params.toString()}`, { cache: 'no-store' });
        const data = await res.json();
        setProductos(data.productos || []);
        if (data.pagination) {
          setTotalItems(data.pagination.totalItems ?? 0);
          setTotalPages(data.pagination.totalPages ?? 1);
        }
        setMarcas(data.marcas || []);
        setCategorias(data.categorias || []);
        setTemporadas(data.temporadas || []);
        setDescuentos(data.descuentos || []);
        setProveedores(data.proveedores || []);
        setTalles(data.talles || []);
        setColores(data.colores || []);
      } finally {
        setLoading(false);
      }
    },
    [
      paginaActual,
      busqueda,
      filtroCategoria,
      filtroMarca,
      filtroTemporada,
      ordenAntiguedad,
    ]
  );

  // Cuando cambia la página o los filtros, se traen las 12 prendas correspondientes del servidor
  useEffect(() => {
    cargarCatalogo(paginaActual);
  }, [cargarCatalogo, paginaActual]);

  const abrirModalNuevaPrenda = () => {
    setModalNuevoProd(true);
  };

  // Las fotos se comprimen en el navegador antes de guardarlas (ver comprimirImagen)
  const [comprimiendoImagen, setComprimiendoImagen] = useState(false);

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

  const handleSubirImagenVarianteEdicion = async (idx: number, file?: File) => {
    if (!file || !productoEditando) return;
    const dataUrl = await prepararImagen(file);
    if (!dataUrl) return;
    // Actualización funcional: asigna la imagen a la variante y a las demás del mismo color
    setProductoEditando((prev) => {
      if (!prev) return prev;
      const nuevas = [...prev.variantes];
      if (!nuevas[idx]) return prev;
      const codColorObj = nuevas[idx].codColor ?? nuevas[idx].color?.codColor;
      const actualizadas = nuevas.map((v, i) => {
        const codC = v.codColor ?? v.color?.codColor;
        if (i === idx || (codColorObj && codC === codColorObj)) {
          return { ...v, imagenVariante: dataUrl };
        }
        return v;
      });
      return {
        ...prev,
        imagen: idx === 0 ? dataUrl : prev.imagen,
        variantes: actualizadas as ProductoCat['variantes'],
      };
    });
  };

  const handleCrearMarcaApartado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaMarcaNombre.trim()) return;
    setGuardandoMarca(true);
    try {
      const res = await fetch('/api/catalogo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoAlta: 'MARCA',
          nombreMarca: nuevaMarcaNombre.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear marca');

      setNotificacion({
        tipo: 'ok',
        texto: `Marca "${data.nombreMarca}" creada y disponible en el sistema.`,
      });
      setNuevaMarcaNombre('');
      await cargarCatalogo(paginaActual);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al crear marca');
    } finally {
      setGuardandoMarca(false);
    }
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
      if (productoEditando) {
        setProductoEditando({ ...productoEditando, codMarca: data.codMarca });
      }
      setNombreMarcaRapida('');
      setMostrarAltaMarcaRapida(false);
    }
  };

  const handleGuardarEdicionMarca = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!marcaEditando) return;
    const res = await fetch('/api/catalogo', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipoEdicion: 'MARCA',
        codMarca: marcaEditando.codMarca,
        nombreMarca: marcaEditando.nombreMarca,
      }),
    });
    if (res.ok) {
      setMarcaEditando(null);
      setNotificacion({ tipo: 'ok', texto: 'Nombre de marca actualizado.' });
      await cargarCatalogo(paginaActual);
    }
  };

  const handleBajaMarca = async (codMarca: number, nombre: string) => {
    if (!confirm(`¿Dar de baja lógica a la marca "${nombre}"?`)) return;
    const res = await fetch(`/api/catalogo?codMarca=${codMarca}`, { method: 'DELETE' });
    if (res.ok) {
      await cargarCatalogo(paginaActual);
    }
  };

  const handleCambioCostoEdicion = (nuevoCosto: number) => {
    if (!productoEditando) return;
    const precioSugerido = calcularPrecioSugerido(nuevoCosto, productoEditando.porcentajeMarkup);
    setProductoEditando({
      ...productoEditando,
      precioCosto: nuevoCosto,
      precio: precioSugerido,
    });
  };

  const handleCambioMarkupEdicion = (nuevoMarkup: number) => {
    if (!productoEditando) return;
    const precioSugerido = calcularPrecioSugerido(productoEditando.precioCosto, nuevoMarkup);
    setProductoEditando({
      ...productoEditando,
      porcentajeMarkup: nuevoMarkup,
      precio: precioSugerido,
    });
  };

  const handleCambioCoeficienteEdicion = (nuevoCoeficiente: number) => {
    if (!productoEditando || nuevoCoeficiente < 1) return;
    const nuevoMarkup = Number(((nuevoCoeficiente - 1) * 100).toFixed(1));
    handleCambioMarkupEdicion(nuevoMarkup);
  };

  const handleCambioPrecioFinalManual = (nuevoPrecioVenta: number) => {
    if (!productoEditando) return;
    const markupReverso = calcularMarkupReverso(productoEditando.precioCosto, nuevoPrecioVenta);
    setProductoEditando({
      ...productoEditando,
      precio: nuevoPrecioVenta,
      porcentajeMarkup: markupReverso,
    });
  };

  const handleSeleccionarDescuentoEdicion = (codDescStr: string) => {
    if (!productoEditando) return;
    if (!codDescStr) {
      setProductoEditando({
        ...productoEditando,
        codDescuento: null,
        descuento: null,
      });
      return;
    }
    const cod = Number(codDescStr);
    const descObj = descuentos.find((d) => d.codDescuento === cod) || null;
    setProductoEditando({
      ...productoEditando,
      codDescuento: cod,
      descuento: descObj,
    });
  };

  const handleCrearProveedorAlVueloCatalogo = async () => {
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
      if (productoEditando) {
        setProductoEditando({
          ...productoEditando,
          codProveedorHabitual: data.codProveedor,
        });
      }
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
      if (productoEditando) {
        setProductoEditando({
          ...productoEditando,
          codDescuento: data.codDescuento,
          descuento: data,
        });
      }
      setNuevoDescRapido((prev) => ({ ...prev, nombreDesc: '', porcentajeDesc: 15 }));
      setMostrarAltaDescRapida(false);
    }
  };

  // Alta de color desde el selector con buscador (queda disponible para todas las prendas)
  const crearColor = async (nombreColor: string, codigoHex: string): Promise<ColorOpcion> => {
    const res = await fetch('/api/catalogo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipoAlta: 'COLOR', nombreColor, codigoHex }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo crear el color');
    const nuevo: ColorOpcion = {
      codColor: data.codColor,
      nombreColor: data.nombreColor,
      codigoHex: data.codigoHex,
    };
    setColores((prev) =>
      prev.some((c) => c.codColor === nuevo.codColor) ? prev : [...prev, nuevo]
    );
    return nuevo;
  };

  const [eliminando, setEliminando] = useState<boolean>(false);

  const eliminarProducto = async () => {
    if (!productoEditando) return;
    const confirmado = confirm(
      `¿Eliminar definitivamente "${productoEditando.nombre}"?\n\n` +
        'Se borran la prenda, sus variantes (stock e imágenes) y su historial de precios. ' +
        'Si la prenda ya tiene ventas o facturas de ingreso, se da de baja en lugar de borrarse, ' +
        'para no alterar pedidos ni reportes.\n\nEsta acción no se puede deshacer.'
    );
    if (!confirmado) return;
    setEliminando(true);
    try {
      const res = await fetch(`/api/catalogo?codProducto=${productoEditando.codProducto}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar la prenda');
      setNotificacion({
        tipo: 'ok',
        texto:
          data.modo === 'BAJA'
            ? `"${productoEditando.nombre}" se dio de baja: ya no aparece en el catálogo ni en la tienda. Se conservó su historial (${data.ventas} venta(s), ${data.ingresos} ingreso(s)).`
            : `"${productoEditando.nombre}" se eliminó definitivamente.`,
      });
      setProductoEditando(null);
      await cargarCatalogo(paginaActual);
      await refreshGlobalState();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setEliminando(false);
    }
  };

  // Una categoría creada desde cualquier formulario aparece al instante en el filtro
  const sumarCategoriaCreada = (cat: CategoriaOpcion) => {
    setCategorias((prev) =>
      agregarCategoria(prev, {
        codCategoria: cat.codCategoria,
        nombreCategoria: cat.nombreCategoria,
        markupPorDefectoCategoria: cat.markupPorDefectoCategoria ?? 120,
      })
    );
  };

  const guardarEdicionProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productoEditando) return;
    setGuardando(true);
    try {
      // Solo se mandan las fotos que cambiaron: el resto ya está guardado. Reenviar todas
      // (una por talle) puede superar el límite de 4,5 MB por petición de Vercel.
      const original = productos.find((p) => p.codProducto === productoEditando.codProducto);
      const imagenOriginalPorVariante = new Map(
        (original?.variantes ?? []).map((v) => [v.codVariante, v.imagenVariante ?? null])
      );
      const cuerpo = {
        ...productoEditando,
        imagen:
          original && original.imagen === productoEditando.imagen
            ? undefined
            : productoEditando.imagen,
        variantes: productoEditando.variantes.map((v) => {
          const sinCambios =
            v.codVariante !== undefined &&
            imagenOriginalPorVariante.has(v.codVariante) &&
            imagenOriginalPorVariante.get(v.codVariante) === (v.imagenVariante ?? null);
          return sinCambios ? { ...v, imagenVariante: undefined } : v;
        }),
      };
      const res = await fetch('/api/catalogo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar cambios');

      if (data.alertasDisparadas && data.alertasDisparadas.length > 0) {
        setNotificacion({
          tipo: 'alerta',
          texto: `Prenda actualizada. Se disparó alerta de WhatsApp por stock < 3 en: ${data.alertasDisparadas
            .map((a: { nombreProducto: string }) => a.nombreProducto)
            .join(', ')}`,
        });
      } else {
        setNotificacion({
          tipo: 'ok',
          texto: `Se actualizaron los datos, variantes, descuento y precios de "${productoEditando.nombre}".`,
        });
      }
      setProductoEditando(null);
      await cargarCatalogo(paginaActual);
      await refreshGlobalState();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setGuardando(false);
    }
  };

  const pctDescuentoEnEdicion = useMemo(() => {
    if (!productoEditando || !productoEditando.codDescuento) return 0;
    const d = descuentos.find((x) => x.codDescuento === Number(productoEditando.codDescuento));
    return d ? d.porcentajeDesc : 0;
  }, [productoEditando, descuentos]);

  const precioNetoEnEdicion = useMemo(() => {
    if (!productoEditando) return 0;
    return calcularPrecioNetoConDescuento(productoEditando.precio, pctDescuentoEnEdicion);
  }, [productoEditando, pctDescuentoEnEdicion]);

  const indiceInicio = totalItems === 0 ? 0 : (paginaActual - 1) * PRENDAS_POR_PAGINA + 1;
  const indiceFin = Math.min(paginaActual * PRENDAS_POR_PAGINA, totalItems);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              Catálogo Maestro
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">
              {totalItems} prendas encontradas (Página {paginaActual} de {totalPages} •{' '}
              {PRENDAS_POR_PAGINA} por página)
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Catálogo de Indumentaria, Marcas, Costos y Markup
          </h1>
          <p className="text-sm text-slate-500">
            Administra las marcas de <strong>Tutina</strong>, incorpora prendas con múltiples talles,
            colores e imágenes, y actualiza costos o descuentos con un clic.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setMostrarApartadoMarcas(!mostrarApartadoMarcas)}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border transition cursor-pointer ${
              mostrarApartadoMarcas
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <BookmarkPlus className="w-4 h-4 text-rose-500" />
            {mostrarApartadoMarcas
              ? 'Ocultar Apartado de Marcas'
              : `Apartado de Marcas (${marcas.length})`}
          </button>

          <button
            type="button"
            onClick={abrirModalNuevaPrenda}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-rose-700 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Nueva Prenda
          </button>
        </div>
      </div>

      {/* Apartado Dedicado para Crear y Gestionar Marcas */}
      {mostrarApartadoMarcas && (
        <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BookmarkPlus className="w-5 h-5 text-rose-600" /> Apartado de Creación y Gestión de
                Marcas
              </h2>
              <p className="text-xs text-slate-500">
                Registra nuevas marcas de indumentaria para clasificar las prendas de Tutina.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMostrarApartadoMarcas(false)}
              className="text-xs text-slate-500 hover:text-slate-800 underline self-start sm:self-auto cursor-pointer"
            >
              Cerrar apartado
            </button>
          </div>

          <form
            onSubmit={handleCrearMarcaApartado}
            className="p-4 rounded-xl bg-rose-50/50 border border-rose-200/80 flex flex-col sm:flex-row items-end gap-3"
          >
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-rose-900 mb-1">
                Nombre de la Nueva Marca *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Nike Women, Adidas Training, Cocot Sport, Línea Propia..."
                value={nuevaMarcaNombre}
                onChange={(e) => setNuevaMarcaNombre(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={guardandoMarca}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition cursor-pointer shrink-0 shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              {guardandoMarca ? 'Guardando...' : 'Crear Marca'}
            </button>
          </form>

          {marcaEditando && (
            <form
              onSubmit={handleGuardarEdicionMarca}
              className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 flex items-center gap-3"
            >
              <span className="text-xs font-bold text-indigo-900">
                Renombrar Marca #{marcaEditando.codMarca}:
              </span>
              <input
                type="text"
                required
                value={marcaEditando.nombreMarca}
                onChange={(e) =>
                  setMarcaEditando({ ...marcaEditando, nombreMarca: e.target.value })
                }
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setMarcaEditando(null)}
                className="text-xs text-slate-500 underline cursor-pointer"
              >
                Cancelar
              </button>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {marcas.map((m) => (
              <div
                key={m.codMarca}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 truncate">{m.nombreMarca}</div>
                  <div className="text-[11px] text-slate-500">
                    {m.productos?.length ?? 0} prenda(s) asociada(s)
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setMarcaEditando(m)}
                    className="text-indigo-600 hover:underline font-semibold cursor-pointer"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBajaMarca(m.codMarca, m.nombreMarca)}
                    className="text-rose-600 hover:underline font-semibold cursor-pointer"
                  >
                    Baja
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notificación de confirmación o alerta */}
      {notificacion && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border ${
            notificacion.tipo === 'alerta'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-3 text-sm font-medium">
            {notificacion.tipo === 'alerta' ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            )}
            <span>{notificacion.texto}</span>
          </div>
          <button
            onClick={() => setNotificacion(null)}
            className="text-xs font-semibold underline ml-4 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Barra de Filtros + Selector de Antigüedad */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPaginaActual(1);
            }}
            placeholder="Buscar prenda, descripción o SKU..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <select
          value={filtroCategoria}
          onChange={(e) => {
            setFiltroCategoria(e.target.value);
            setPaginaActual(1);
          }}
          className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <option value="TODAS">Categoría: Todas</option>
          {categorias.map((c) => (
            <option key={c.codCategoria} value={c.codCategoria}>
              {c.nombreCategoria} ({c.markupPorDefectoCategoria}% Markup)
            </option>
          ))}
        </select>

        <select
          value={filtroMarca}
          onChange={(e) => {
            setFiltroMarca(e.target.value);
            setPaginaActual(1);
          }}
          className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <option value="TODAS">Marca: Todas</option>
          {marcas.map((m) => (
            <option key={m.codMarca} value={m.codMarca}>
              {m.nombreMarca}
            </option>
          ))}
        </select>

        <select
          value={filtroTemporada}
          onChange={(e) => {
            setFiltroTemporada(e.target.value);
            setPaginaActual(1);
          }}
          className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <option value="TODAS">Temporada: Todas</option>
          {temporadas.map((t) => (
            <option key={t.codTemporada} value={t.codTemporada}>
              {t.nombreTemporada}
            </option>
          ))}
        </select>

        {/* Nuevo Filtro por Antigüedad de las Prendas */}
        <div className="relative">
          <ArrowUpDown className="w-3.5 h-3.5 text-rose-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={ordenAntiguedad}
            onChange={(e) => {
              setOrdenAntiguedad(e.target.value as 'MAS_RECIENTES' | 'MAS_ANTIGUAS');
              setPaginaActual(1);
            }}
            className="w-full pl-8 pr-3 py-2 text-xs font-bold rounded-xl border border-rose-200 bg-rose-50/40 text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="MAS_RECIENTES">Antigüedad: Más recientes primero</option>
            <option value="MAS_ANTIGUAS">Antigüedad: Más antiguas primero</option>
          </select>
        </div>
      </div>

      {/* Grilla Visual del Catálogo (12 prendas por página) */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm">
          Cargando página {paginaActual} del catálogo de Tutina (de a {PRENDAS_POR_PAGINA}{' '}
          prendas)...
        </div>
      ) : productos.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-sm text-slate-500">
          No se encontraron prendas con los filtros seleccionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {productos.map((prod) => {
            const stockTotal = prod.variantes.reduce((acc, v) => acc + v.stock, 0);
            const variantesCriticas = prod.variantes.filter((v) => v.stock < 3);
            const pctDesc = obtenerPorcentajeDescuentoVigente(prod.descuento);
            const precioConDesc = calcularPrecioNetoConDescuento(prod.precio, pctDesc);
            const coefReventa = calcularCoeficienteReventa(prod.porcentajeMarkup);
            const gananciaUnitaria = precioConDesc - prod.precioCosto;
            const temporadaTexto =
              prod.productosTemporada.map((pt) => pt.temporada.nombreTemporada).join(', ') ||
              'Todo el año';

            return (
              <div
                key={prod.codProducto}
                onClick={() => setProductoEditando(JSON.parse(JSON.stringify(prod)))}
                className="group bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md hover:border-rose-300 transition-all flex flex-col cursor-pointer"
              >
                {/* Imagen y Badges Superiores */}
                <div className="relative h-56 w-full bg-slate-100 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={prod.imagen}
                    alt={prod.nombre}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900/80 text-white backdrop-blur-xs">
                      {prod.categoria.nombreCategoria}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/90 text-slate-800 backdrop-blur-xs">
                      {prod.marca.nombreMarca}
                    </span>
                    {!prod.visibleEnTiendaOnline && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-white inline-flex items-center gap-1">
                        <EyeOff className="w-3 h-3" /> Oculta en tienda
                      </span>
                    )}
                  </div>

                  {pctDesc > 0 && (
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-600 text-white shadow-xs flex items-center gap-1">
                      <Percent className="w-3 h-3" /> -{pctDesc}% OFF
                    </div>
                  )}

                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-white/90 text-slate-700 backdrop-blur-xs">
                      {temporadaTexto}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-bold backdrop-blur-xs ${
                        variantesCriticas.length > 0
                          ? 'bg-amber-500 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      Stock Total: {stockTotal} u.
                    </span>
                  </div>
                </div>

                {/* Cuerpo de la Prenda */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900 text-base group-hover:text-rose-600 transition">
                        {prod.nombre}
                      </h3>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 shrink-0 bg-rose-50 px-2 py-1 rounded-lg">
                        <Edit3 className="w-3.5 h-3.5" /> Editar
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1">{prod.descripcion}</p>
                  </div>

                  {/* Desglose de Variantes (Talles/Colores y Alerta Stock < 3) */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Stock por Talle y Color
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {prod.variantes.map((v) => {
                        const esCritico = v.stock < 3;
                        return (
                          <span
                            key={v.codVariante}
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border ${
                              esCritico
                                ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            {v.imagenVariante ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={v.imagenVariante}
                                alt=""
                                className="w-4 h-4 rounded-full object-cover border border-slate-300"
                              />
                            ) : (
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-slate-300"
                                style={{
                                  backgroundColor: mapearTextoAColorHex(
                                    v.color?.nombreColor || '',
                                    v.color?.codigoHex
                                  ),
                                }}
                              />
                            )}
                            <span>
                              {v.talle?.nombreTalle} ({v.color?.nombreColor}):{' '}
                              <strong>{v.stock}</strong>
                            </span>
                            {esCritico && (
                              <span title="Stock < 3 (Alerta WhatsApp)">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Panel Financiero de la Prenda: Costo + Markup + Precio Venta */}
                  <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 bg-slate-50/80 p-3 rounded-xl">
                    <div>
                      <div className="text-[10px] font-semibold uppercase text-slate-400">
                        Precio Costo
                      </div>
                      <div className="text-sm font-bold text-slate-700">
                        ${prod.precioCosto.toLocaleString('es-AR')}
                      </div>
                    </div>

                    <div className="border-x border-slate-200 px-2">
                      <div className="text-[10px] font-semibold uppercase text-slate-400">
                        Markup / Coef.
                      </div>
                      <div className="text-sm font-bold text-indigo-600">
                        +{prod.porcentajeMarkup}%{' '}
                        <span className="text-[11px] font-normal text-slate-500">
                          ({coefReventa}x)
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-semibold uppercase text-slate-400">
                        Precio Venta
                      </div>
                      {pctDesc > 0 ? (
                        <div>
                          <span className="text-[11px] line-through text-slate-400 mr-1">
                            ${prod.precio.toLocaleString('es-AR')}
                          </span>
                          <span className="text-sm font-extrabold text-rose-600">
                            ${precioConDesc.toLocaleString('es-AR')}
                          </span>
                        </div>
                      ) : (
                        <div className="text-sm font-extrabold text-emerald-700">
                          ${prod.precio.toLocaleString('es-AR')}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Margen Bruto Unit.:{' '}
                      <strong className="text-emerald-700">
                        +${gananciaUnitaria.toLocaleString('es-AR')}
                      </strong>
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      ID #{prod.codProducto}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================================================================= */}
      {/* BARRA DE PAGINACIÓN DEL CATÁLOGO (12 PRENDAS POR PÁGINA)          */}
      {/* ================================================================= */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-slate-600">
          Mostrando <strong>{indiceInicio}</strong> a <strong>{indiceFin}</strong> de{' '}
          <strong>{totalItems}</strong> prendas totales ({PRENDAS_POR_PAGINA} prendas por página •
          Orden:{' '}
          <strong>
            {ordenAntiguedad === 'MAS_RECIENTES'
              ? 'Más recientes primero'
              : 'Más antiguas primero'}
          </strong>
          )
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={paginaActual <= 1 || loading}
            onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer transition"
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((numPag) => (
            <button
              key={numPag}
              type="button"
              onClick={() => setPaginaActual(numPag)}
              className={`w-9 h-9 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                numPag === paginaActual
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {numPag}
            </button>
          ))}

          <button
            type="button"
            disabled={paginaActual >= totalPages || loading}
            onClick={() => setPaginaActual((p) => Math.min(totalPages, p + 1))}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer transition"
          >
            Siguiente <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* =========================================================================== */}
      {/* MODAL DE EDICIÓN DE PRENDA: COSTO, MARKUP, PRECIO, DESCUENTO Y VARIANTES    */}
      {/* =========================================================================== */}
      {productoEditando && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Calculator className="w-5 h-5 text-rose-400" />
                <div>
                  <h2 className="text-base font-bold">
                    Editar Prenda: Costo, Markup, Descuento y Variantes
                  </h2>
                  <p className="text-xs text-slate-400">{productoEditando.nombre}</p>
                </div>
              </div>
              <button
                onClick={() => setProductoEditando(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={guardarEdicionProducto}
              className="p-6 space-y-6 max-h-[82vh] overflow-y-auto"
            >
              {/* Visibilidad en la tienda pública */}
              <label className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 bg-slate-50/70 cursor-pointer">
                <div className="flex items-start gap-2.5">
                  <EyeOff className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-slate-800">No mostrar prenda</div>
                    <p className="text-xs text-slate-500">
                      Oculta la prenda de la tienda pública. Sigue visible y editable en este panel.
                    </p>
                  </div>
                </div>
                <span className="relative inline-flex shrink-0">
                  <input
                    type="checkbox"
                    role="switch"
                    className="peer sr-only"
                    checked={!productoEditando.visibleEnTiendaOnline}
                    onChange={(e) =>
                      setProductoEditando({
                        ...productoEditando,
                        visibleEnTiendaOnline: !e.target.checked,
                      })
                    }
                  />
                  <span className="w-11 h-6 rounded-full bg-slate-300 peer-checked:bg-rose-600 transition peer-focus-visible:ring-2 peer-focus-visible:ring-rose-300" />
                  <span className="dm-switch-perilla absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                </span>
              </label>

              {/* Simulador interactivo de Precio de Costo -> Markup -> Precio de Venta */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-50/70 via-white to-indigo-50/50 border border-rose-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Calculadora Automática de Reventa (Markup)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCambioMarkupEdicion(
                        productoEditando.categoria.markupPorDefectoCategoria || 120
                      )
                    }
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Aplicar Markup por defecto de Categoría (
                    {productoEditando.categoria.markupPorDefectoCategoria}%)
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      1. Precio de Costo ($)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="50"
                      value={productoEditando.precioCosto}
                      onChange={(e) => handleCambioCostoEdicion(Number(e.target.value))}
                      className="w-full px-3 py-2 text-base font-bold text-slate-900 rounded-lg border border-slate-300"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Cobrado por el proveedor
                    </span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-indigo-200 shadow-2xs">
                    <label className="block text-xs font-bold text-indigo-700 mb-1">
                      2. Margen Markup (%)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={productoEditando.porcentajeMarkup}
                      onChange={(e) => handleCambioMarkupEdicion(Number(e.target.value))}
                      className="w-full px-3 py-2 text-base font-bold text-indigo-700 rounded-lg border border-indigo-300"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">% sobre el costo</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-indigo-200 shadow-2xs">
                    <label className="block text-xs font-bold text-indigo-700 mb-1">
                      Coeficiente (Ej. 2.30x)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min={1}
                      value={calcularCoeficienteReventa(productoEditando.porcentajeMarkup)}
                      onChange={(e) => handleCambioCoeficienteEdicion(Number(e.target.value))}
                      className="w-full px-3 py-2 text-base font-bold text-indigo-700 rounded-lg border border-indigo-300"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Costo × Coeficiente
                    </span>
                  </div>

                  <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-300 shadow-2xs">
                    <label className="block text-xs font-bold text-emerald-800 mb-1">
                      3. Precio Venta Lista ($)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="100"
                      value={productoEditando.precio}
                      onChange={(e) => handleCambioPrecioFinalManual(Number(e.target.value))}
                      className="w-full px-3 py-2 text-base font-extrabold text-emerald-800 bg-white rounded-lg border border-emerald-400"
                    />
                    <span className="text-[11px] text-emerald-700 mt-1 block">
                      Sugerido: $
                      {calcularPrecioSugerido(
                        productoEditando.precioCosto,
                        productoEditando.porcentajeMarkup
                      ).toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bloque de Gestión, Creación y Remoción de Descuento Promocional */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Percent className="w-4 h-4 text-rose-600" /> Descuento Promocional de la
                      Prenda
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Selecciona un descuento existente, crea uno nuevo al instante o quítalo para
                      vender al precio de lista.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setMostrarAltaDescRapida(!mostrarAltaDescRapida)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-rose-300 text-rose-700 text-xs font-bold hover:bg-rose-50 transition cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {mostrarAltaDescRapida ? 'Cancelar nuevo' : 'Crear nuevo descuento'}
                    </button>

                    {productoEditando.codDescuento !== null && (
                      <button
                        type="button"
                        onClick={() => handleSeleccionarDescuentoEdicion('')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition cursor-pointer shadow-2xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Quitar descuento de esta prenda
                      </button>
                    )}
                  </div>
                </div>

                {mostrarAltaDescRapida && (
                  <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold uppercase text-rose-900 mb-1">
                        Nombre de la Promo *
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Promo Invierno / Liquidación"
                        value={nuevoDescRapido.nombreDesc}
                        onChange={(e) =>
                          setNuevoDescRapido({ ...nuevoDescRapido, nombreDesc: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold uppercase text-rose-900 mb-1">
                        % Descuento *
                      </label>
                      <input
                        type="number"
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
                    value={productoEditando.codDescuento || ''}
                    onChange={(e) => handleSeleccionarDescuentoEdicion(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm font-medium rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="">✓ Sin descuento aplicado (Precio de Lista Completo)</option>
                    {descuentos.map((d) => (
                      <option key={d.codDescuento} value={d.codDescuento}>
                        {d.nombreDesc} (-{d.porcentajeDesc}% OFF)
                      </option>
                    ))}
                  </select>

                  <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600">
                      Precio Final al Cliente hoy:
                    </span>
                    {pctDescuentoEnEdicion > 0 ? (
                      <div className="text-right">
                        <span className="line-through text-slate-400 mr-1.5">
                          ${productoEditando.precio.toLocaleString('es-AR')}
                        </span>
                        <span className="text-sm font-extrabold text-rose-600">
                          ${precioNetoEnEdicion.toLocaleString('es-AR')} (-
                          {pctDescuentoEnEdicion}%)
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm font-extrabold text-emerald-700">
                        ${productoEditando.precio.toLocaleString('es-AR')} (Sin descuento)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Datos Comerciales, Marca, Categoría y Proveedor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nombre de la Prenda
                  </label>
                  <input
                    type="text"
                    required
                    value={productoEditando.nombre}
                    onChange={(e) =>
                      setProductoEditando({ ...productoEditando, nombre: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Marca</label>
                    <button
                      type="button"
                      onClick={() => setMostrarAltaMarcaRapida(!mostrarAltaMarcaRapida)}
                      className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      + Nueva Marca
                    </button>
                  </div>
                  <select
                    value={productoEditando.codMarca}
                    onChange={(e) =>
                      setProductoEditando({
                        ...productoEditando,
                        codMarca: Number(e.target.value),
                      })
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

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Categoría
                  </label>
                  <CategoriaSelector
                    categorias={categorias}
                    value={productoEditando.codCategoria}
                    onChange={(cat) =>
                      // Se actualiza también el objeto categoría: lo usa el botón de markup por defecto
                      setProductoEditando((prev) =>
                        prev
                          ? {
                              ...prev,
                              codCategoria: cat.codCategoria,
                              categoria: {
                                ...prev.categoria,
                                codCategoria: cat.codCategoria,
                                nombreCategoria: cat.nombreCategoria,
                                markupPorDefectoCategoria:
                                  cat.markupPorDefectoCategoria ??
                                  prev.categoria.markupPorDefectoCategoria,
                              },
                            }
                          : prev
                      )
                    }
                    onCategoriaCreada={sumarCategoriaCreada}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Proveedor Habitual
                    </label>
                    <button
                      type="button"
                      onClick={() => setMostrarAltaProvRapida(!mostrarAltaProvRapida)}
                      className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      + Nuevo Proveedor
                    </button>
                  </div>
                  <select
                    value={productoEditando.codProveedorHabitual || ''}
                    onChange={(e) =>
                      setProductoEditando({
                        ...productoEditando,
                        codProveedorHabitual: e.target.value ? Number(e.target.value) : null,
                      })
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
              </div>

              {mostrarAltaMarcaRapida && (
                <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 flex items-center gap-2">
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

              {mostrarAltaProvRapida && (
                <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 flex flex-col sm:flex-row items-end gap-2.5">
                  <div className="flex-1 w-full">
                    <label className="block text-[11px] font-bold text-rose-900 mb-1">
                      Registrar Proveedor que no está en el sistema *
                    </label>
                    <input
                      type="text"
                      placeholder="Nombre / Razón Social del Proveedor"
                      value={nuevoProvRapido.nombreProveedor}
                      onChange={(e) =>
                        setNuevoProvRapido({ ...nuevoProvRapido, nombreProveedor: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div className="w-full sm:w-44">
                    <label className="block text-[11px] font-bold text-rose-900 mb-1">
                      Teléfono WhatsApp *
                    </label>
                    <input
                      type="text"
                      placeholder="+54911..."
                      value={nuevoProvRapido.numeroProveedor}
                      onChange={(e) =>
                        setNuevoProvRapido({ ...nuevoProvRapido, numeroProveedor: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCrearProveedorAlVueloCatalogo}
                    className="px-4 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer shrink-0"
                  >
                    Guardar Proveedor
                  </button>
                </div>
              )}

              {/* Lista Editable de Variantes (Talle, Color, Stock e Imagen) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-slate-500" /> Lista de Variantes (Talle, Color,
                    Stock e Imagen)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const nuevas = [
                        ...productoEditando.variantes,
                        {
                          codTalle: talles[0]?.codTalle ?? 1,
                          codColor: colores[0]?.codColor ?? 1,
                          stock: 5,
                          imagenVariante: null,
                          talle: talles[0] || { codTalle: 1, nombreTalle: 'S' },
                          color: colores[0] || {
                            codColor: 1,
                            nombreColor: 'Negro',
                            codigoHex: '#111',
                          },
                        },
                      ];
                      setProductoEditando({
                        ...productoEditando,
                        variantes: nuevas as ProductoCat['variantes'],
                      });
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar nuevo elemento Talle / Color
                  </button>
                </div>

                <div className="space-y-2.5">
                  {productoEditando.variantes.map((v, idx) => (
                    <div
                      key={v.codVariante ?? `new-${idx}`}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center text-xs"
                    >
                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                          Talle
                        </label>
                        <select
                          value={v.codTalle ?? v.talle?.codTalle}
                          onChange={(e) => {
                            const codT = Number(e.target.value);
                            const tObj = talles.find((x) => x.codTalle === codT);
                            const nuevas = [...productoEditando.variantes];
                            nuevas[idx] = { ...v, codTalle: codT, talle: tObj || v.talle };
                            setProductoEditando({
                              ...productoEditando,
                              variantes: nuevas as ProductoCat['variantes'],
                            });
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold"
                        >
                          {talles.map((t) => (
                            <option key={t.codTalle} value={t.codTalle}>
                              {t.nombreTalle}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                          Color
                        </label>
                        <ColorSelector
                          colores={colores}
                          value={v.codColor ?? v.color?.codColor}
                          onCrearColor={crearColor}
                          onChange={(cObj) => {
                            const nuevas = [...productoEditando.variantes];
                            nuevas[idx] = { ...v, codColor: cObj.codColor, color: cObj };
                            setProductoEditando({
                              ...productoEditando,
                              variantes: nuevas as ProductoCat['variantes'],
                            });
                          }}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                          Stock
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={v.stock}
                          onChange={(e) => {
                            const nuevas = [...productoEditando.variantes];
                            nuevas[idx] = { ...v, stock: Number(e.target.value) };
                            setProductoEditando({
                              ...productoEditando,
                              variantes: nuevas as ProductoCat['variantes'],
                            });
                          }}
                          className="w-full px-2.5 py-1.5 font-bold rounded-lg border border-slate-300 bg-white"
                        />
                      </div>

                      <div className="sm:col-span-4 flex items-center gap-2">
                        <div className="w-10 h-10 rounded-lg border border-slate-200 bg-white overflow-hidden flex items-center justify-center shrink-0">
                          {v.imagenVariante ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={v.imagenVariante}
                              alt="Variante"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-slate-300" />
                          )}
                        </div>
                        <label className="flex-1 py-1.5 px-2.5 rounded-lg border border-dashed border-rose-300 bg-rose-50/50 text-[11px] font-bold text-rose-700 hover:bg-rose-100/60 cursor-pointer text-center truncate">
                          <Upload className="w-3 h-3 inline mr-1" />
                          {v.imagenVariante ? 'Cambiar foto' : 'Cargar imagen'}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              handleSubirImagenVarianteEdicion(idx, e.target.files?.[0])
                            }
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={eliminarProducto}
                  disabled={eliminando || guardando}
                  className="mr-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 text-sm font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {eliminando ? 'Eliminando...' : 'Eliminar prenda'}
                </button>
                <button
                  type="button"
                  onClick={() => setProductoEditando(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando || comprimiendoImagen}
                  className="px-5 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition cursor-pointer disabled:opacity-50"
                >
                  {comprimiendoImagen
                    ? 'Procesando foto...'
                    : guardando
                    ? 'Guardando...'
                    : 'Guardar Cambios de la Prenda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================== */}
      {/* MODAL DE ALTA DE NUEVA PRENDA CON LISTA DINÁMICA (TALLE, COLOR, STOCK, IMG) */}
      {/* =========================================================================== */}
      <NuevaPrendaModal
        abierto={modalNuevoProd}
        onClose={() => setModalNuevoProd(false)}
        marcasIniciales={marcas}
        categorias={categorias}
        temporadas={temporadas}
        descuentosIniciales={descuentos}
        proveedoresIniciales={proveedores}
        talles={talles}
        coloresIniciales={colores}
        onCategoriaCreada={sumarCategoriaCreada}
        onSuccess={async (nuevoProd) => {
          setModalNuevoProd(false);
          setNotificacion({
            tipo: 'ok',
            texto: `¡Prenda "${nuevoProd.nombre}" creada con ${nuevoProd.variantes.length} variante(s) de talle y color!`,
          });
          setPaginaActual(1);
          await cargarCatalogo(1);
          await refreshGlobalState();
        }}
      />
    </div>
  );
}
