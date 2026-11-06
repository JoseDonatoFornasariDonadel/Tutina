'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  EyeOff,
  SlidersHorizontal,
  Camera,
  Images,
} from 'lucide-react';
import type { ColorOpcion } from '@/components/catalogo/ColorSelector';
import {
  CategoriaSelector,
  agregarCategoria,
  type CategoriaOpcion,
} from '@/components/catalogo/CategoriaSelector';
import { NuevaPrendaModal } from '@/components/catalogo/NuevaPrendaModal';
import { GestionFotosSheet, type ColorDeLaPrenda } from '@/components/catalogo/GestionFotosSheet';
import {
  GestionVariantesSheet,
  type VarianteEditable,
} from '@/components/catalogo/GestionVariantesSheet';
import { useGaleriaPrenda, type GaleriaPrenda } from '@/components/catalogo/galeriaPrenda';
import { ImagenProducto } from '@/components/tienda/ImagenProducto';
import { BottomSheet } from '@/components/mobile/BottomSheet';
import { mapearTextoAColorHex } from '@/lib/colores';
import {
  calcularCoeficienteReventa,
  calcularMarkupReverso,
  calcularPrecioNetoConDescuento,
  calcularPrecioSugerido,
  obtenerPorcentajeDescuentoVigente,
} from '@/lib/services/pricing.service';
import { useAppConfig } from '@/components/layout/AppShell';

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
  // En celular los filtros van en un panel inferior
  const [filtrosMovilAbiertos, setFiltrosMovilAbiertos] = useState(false);

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

        // ligero=1: las fotos llegan como URL corta en vez de base64 (carga mucho más rápida)
        params.set('ligero', '1');
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

  // Fotos (por color) y variantes de la prenda en edición: cada una en su propio panel
  const {
    galeria,
    setGaleria,
    cargando: cargandoGaleria,
    error: errorGaleria,
    faltaActualizarBase,
    recargar: recargarGaleria,
  } = useGaleriaPrenda(productoEditando?.codProducto ?? null);
  const [panelFotos, setPanelFotos] = useState<{ codColor?: number } | null>(null);
  const [panelVariantes, setPanelVariantes] = useState(false);
  // Las fotos se guardan al instante: al cerrar la edición se refresca el catálogo
  const fotosCambiadas = useRef(false);

  const alActualizarGaleria = (nueva: GaleriaPrenda) => {
    setGaleria(nueva);
    fotosCambiadas.current = true;
    // Las miniaturas de la edición muestran la portada nueva de cada color
    const portadas = new Map(nueva.colores.map((c) => [c.codColor, c.fotos[0]?.url ?? null]));
    setProductoEditando((prev) =>
      prev
        ? {
            ...prev,
            variantes: prev.variantes.map((v) => {
              const cod = v.codColor ?? v.color?.codColor;
              return cod !== undefined && portadas.has(cod)
                ? { ...v, imagenVariante: portadas.get(cod) }
                : v;
            }) as ProductoCat['variantes'],
          }
        : prev
    );
  };

  useEffect(() => {
    if (productoEditando) return;
    setPanelFotos(null);
    setPanelVariantes(false);
    if (fotosCambiadas.current) {
      fotosCambiadas.current = false;
      cargarCatalogo(paginaActual);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoEditando === null]);

  const productoOriginal = useMemo(
    () =>
      productoEditando
        ? productos.find((p) => p.codProducto === productoEditando.codProducto) ?? null
        : null,
    [productoEditando, productos]
  );

  // Colores de la prenda en la edición, con sus talles (comparten las fotos)
  const coloresEnEdicion = useMemo<ColorDeLaPrenda[]>(() => {
    if (!productoEditando) return [];
    const mapa = new Map<number, ColorDeLaPrenda>();
    for (const v of productoEditando.variantes) {
      const cod = v.codColor ?? v.color?.codColor;
      if (cod === undefined) continue;
      const c =
        colores.find((x) => x.codColor === cod) ??
        v.color ?? { codColor: cod, nombreColor: 'Color', codigoHex: '#111827' };
      const item = mapa.get(cod) ?? { ...c, codColor: cod, talles: [] };
      const nombreTalle =
        talles.find((t) => t.codTalle === (v.codTalle ?? v.talle?.codTalle))?.nombreTalle ??
        v.talle?.nombreTalle;
      if (nombreTalle && !item.talles.includes(nombreTalle)) item.talles.push(nombreTalle);
      mapa.set(cod, item);
    }
    return [...mapa.values()];
  }, [productoEditando, colores, talles]);

  // Hay cambios de talle, color o stock que todavía no se guardaron
  const variantesSinGuardar = useMemo(() => {
    if (!productoEditando) return false;
    const resumen = (lista: VarianteEditable[]) =>
      JSON.stringify(
        lista.map((v) => [
          v.codVariante ?? null,
          v.codTalle ?? v.talle?.codTalle,
          v.codColor ?? v.color?.codColor,
          Number(v.stock),
        ])
      );
    return resumen(productoEditando.variantes) !== resumen(productoOriginal?.variantes ?? []);
  }, [productoEditando, productoOriginal]);

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
      // Las fotos se guardan aparte, desde «Gestionar fotos»: acá no se reenvían
      const cuerpo = {
        ...productoEditando,
        imagen: undefined,
        variantes: productoEditando.variantes.map((v) => ({ ...v, imagenVariante: undefined })),
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

  const filtrosActivos =
    (filtroCategoria !== 'TODAS' ? 1 : 0) +
    (filtroMarca !== 'TODAS' ? 1 : 0) +
    (filtroTemporada !== 'TODAS' ? 1 : 0) +
    (ordenAntiguedad !== 'MAS_RECIENTES' ? 1 : 0);

  // Selectores de categoría, marca, temporada y orden (escritorio y panel inferior móvil)
  const renderSelectoresFiltro = () => (
    <>
        <select
          aria-label="Filtrar por categoría"
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
          aria-label="Filtrar por marca"
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
          aria-label="Filtrar por temporada"
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
            aria-label="Ordenar por antigüedad"
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
    </>
  );

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              Catálogo Maestro
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">
              {totalItems} prendas encontradas (Página {paginaActual} de {totalPages} •{' '}
              {PRENDAS_POR_PAGINA} por página)
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 sm:mt-1">
            <span className="sm:hidden">Catálogo</span>
            <span className="hidden sm:inline">
              Catálogo de Indumentaria, Marcas, Costos y Markup
            </span>
          </h1>
          <p className="sm:hidden text-xs text-slate-500 mt-0.5">
            {totalItems} prendas • Página {paginaActual} de {totalPages}
          </p>
          <p className="hidden sm:block text-sm text-slate-500">
            Administra las marcas de <strong>Tutina</strong>, incorpora prendas con múltiples talles,
            colores e imágenes, y actualiza costos o descuentos con un clic.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setMostrarApartadoMarcas(!mostrarApartadoMarcas)}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 min-h-11 sm:min-h-0 py-2.5 text-sm font-semibold border transition cursor-pointer ${
              mostrarApartadoMarcas
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <BookmarkPlus className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="sm:hidden">
              {mostrarApartadoMarcas ? 'Ocultar marcas' : `Marcas (${marcas.length})`}
            </span>
            <span className="hidden sm:inline">
              {mostrarApartadoMarcas
                ? 'Ocultar Apartado de Marcas'
                : `Apartado de Marcas (${marcas.length})`}
            </span>
          </button>

          <button
            type="button"
            onClick={abrirModalNuevaPrenda}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 min-h-11 sm:min-h-0 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-rose-700 transition cursor-pointer"
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
              <input aria-label="Nombre de la Nueva Marca"
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
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 grid grid-cols-[1fr_auto] sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
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

        {/* Celular: botón que abre los filtros en un panel inferior */}
        <button
          type="button"
          onClick={() => setFiltrosMovilAbiertos(true)}
          className="sm:hidden relative touch-target px-3 rounded-xl border border-slate-200 bg-white text-slate-700 cursor-pointer gap-1.5 text-sm font-bold"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filtros
          {filtrosActivos > 0 && (
            <span className="min-w-5 h-5 px-1 rounded-full bg-rose-600 text-white text-[11px] font-extrabold flex items-center justify-center">
              {filtrosActivos}
            </span>
          )}
        </button>

        {/* Escritorio: selectores en la misma fila (display: contents los deja en la grilla) */}
        <div className="hidden sm:contents">{renderSelectoresFiltro()}</div>
      </div>

      <BottomSheet
        abierto={filtrosMovilAbiertos}
        onCerrar={() => setFiltrosMovilAbiertos(false)}
        titulo="Filtros del catálogo"
        subtitulo={`${totalItems} prendas encontradas`}
        pie={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setFiltroCategoria('TODAS');
                setFiltroMarca('TODAS');
                setFiltroTemporada('TODAS');
                setOrdenAntiguedad('MAS_RECIENTES');
                setPaginaActual(1);
              }}
              className="min-h-12 px-4 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 cursor-pointer"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => setFiltrosMovilAbiertos(false)}
              className="flex-1 min-h-12 rounded-xl bg-rose-600 text-white text-sm font-bold active:bg-rose-700 cursor-pointer"
            >
              {loading ? 'Buscando…' : `Ver ${totalItems} prendas`}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 [&_select]:w-full">{renderSelectoresFiltro()}</div>
      </BottomSheet>

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
                role="button"
                tabIndex={0}
                aria-label={`Editar ${prod.nombre}`}
                onClick={() => setProductoEditando(JSON.parse(JSON.stringify(prod)))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setProductoEditando(JSON.parse(JSON.stringify(prod)));
                  }
                }}
                className="group bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md hover:border-rose-300 active:border-rose-300 transition-all flex flex-col cursor-pointer"
              >
                {/* Celular: miniatura + datos clave en una fila (la foto grande ocupaba media pantalla) */}
                <div className="sm:hidden flex gap-3 p-3 pb-0">
                  <div className="relative w-20 h-20 shrink-0 rounded-xl bg-slate-100 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={prod.imagen} alt="" className="w-full h-full object-cover" />
                    {pctDesc > 0 && (
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-600 text-white">
                        -{pctDesc}%
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-bold text-slate-900 text-[15px] leading-snug line-clamp-2">
                        {prod.nombre}
                      </h2>
                      <Edit3 className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {prod.categoria.nombreCategoria} • {prod.marca.nombreMarca} • {temporadaTexto}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          variantesCriticas.length > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        Stock: {stockTotal} u.
                      </span>
                      {!prod.visibleEnTiendaOnline && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500 text-white inline-flex items-center gap-1">
                          <EyeOff className="w-3 h-3" /> Oculta
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Imagen y Badges Superiores (desde sm) */}
                <div className="hidden sm:block relative h-56 w-full bg-slate-100 overflow-hidden">
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
                <div className="p-3 sm:p-5 flex-1 flex flex-col justify-between space-y-3 sm:space-y-4">
                  <div className="hidden sm:block">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-bold text-slate-900 text-base group-hover:text-rose-600 transition">
                        {prod.nombre}
                      </h2>
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
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="hidden sm:block text-xs text-slate-600">
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

        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-1.5">
          <button
            type="button"
            disabled={paginaActual <= 1 || loading}
            onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 px-3 min-h-11 sm:min-h-0 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer transition"
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>

          {/* En celular, con muchas páginas los números no entran: solo "Página X de Y" */}
          <span className="sm:hidden text-sm font-bold text-slate-700">
            Página {paginaActual} de {totalPages}
          </span>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((numPag) => (
            <button
              key={numPag}
              type="button"
              onClick={() => setPaginaActual(numPag)}
              className={`hidden sm:block w-9 h-9 rounded-xl text-xs font-extrabold transition cursor-pointer ${
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
            className="inline-flex items-center gap-1 px-3 min-h-11 sm:min-h-0 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer transition"
          >
            Siguiente <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* =========================================================================== */}
      {/* MODAL DE EDICIÓN DE PRENDA: COSTO, MARKUP, PRECIO, DESCUENTO Y VARIANTES    */}
      {/* =========================================================================== */}
      {productoEditando && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start sm:items-center justify-center sm:p-4 overflow-y-auto scroll-touch">
          <div role="dialog" aria-modal="true" aria-label={`Editar ${productoEditando.nombre}`} className="bg-white sm:rounded-2xl max-w-4xl w-full min-h-dvh sm:min-h-0 border-slate-200 sm:border shadow-2xl sm:overflow-hidden sm:my-8">
            <div className="sticky top-0 z-20 sm:static bg-slate-900 text-white pt-safe">
              <div className="px-4 sm:px-6 py-2 sm:py-4 min-h-14 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Calculator className="w-5 h-5 text-rose-400 shrink-0" />
                  <div className="min-w-0">
                    <h2 className="text-base font-bold truncate">
                      <span className="sm:hidden">{productoEditando.nombre}</span>
                      <span className="hidden sm:inline">
                        Editar Prenda: Costo, Markup, Descuento y Variantes
                      </span>
                    </h2>
                    <p className="hidden sm:block text-xs text-slate-400">{productoEditando.nombre}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setProductoEditando(null)}
                  aria-label="Cerrar"
                  className="touch-target -mr-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Celular: accesos directos a cada sección del formulario */}
              <nav aria-label="Secciones" className="sm:hidden scroll-chips scroll-px-4 flex gap-2 px-4 pb-2.5">
                {[
                  { id: 'edicion-precio', label: 'Precio' },
                  { id: 'edicion-descuento', label: 'Descuento' },
                  { id: 'edicion-datos', label: 'Datos' },
                  { id: 'edicion-talles', label: 'Fotos y talles' },
                ].map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() =>
                      document
                        .getElementById(sec.id)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                    className="shrink-0 min-h-9 px-3.5 rounded-full bg-slate-800 text-slate-100 text-sm font-semibold active:bg-slate-700 cursor-pointer"
                  >
                    {sec.label}
                  </button>
                ))}
              </nav>
            </div>

            <form
              onSubmit={guardarEdicionProducto}
              className="p-4 sm:p-6 space-y-5 sm:space-y-6 sm:max-h-[82vh] sm:overflow-y-auto"
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
              <div
                id="edicion-precio"
                className="scroll-mt-32 sm:scroll-mt-4 p-3 sm:p-5 rounded-2xl bg-gradient-to-br from-rose-50/70 via-white to-indigo-50/50 border border-rose-200/80 space-y-4"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
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

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      1. Precio de Costo ($)
                    </label>
                    <input aria-label="1. Precio de Costo ($)"
                      type="number"
                inputMode="decimal"
                      min={0}
                      step="any"
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
                    <input aria-label="2. Margen Markup (%)"
                      type="number"
                inputMode="decimal"
                      step="any"
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
                    <input aria-label="Coeficiente (Ej. 2.30x)"
                      type="number"
                inputMode="decimal"
                      step="any"
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
                    <input aria-label="3. Precio Venta Lista ($)"
                      type="number"
                inputMode="decimal"
                      min={0}
                      step="any"
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
              <div
                id="edicion-descuento"
                className="scroll-mt-32 sm:scroll-mt-4 p-3 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
              >
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
                      <input aria-label="Nombre de la Promo"
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
                      <input aria-label="% Descuento"
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
                    aria-label="Descuento promocional de la prenda"
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
              <div
                id="edicion-datos"
                className="scroll-mt-32 sm:scroll-mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nombre de la Prenda
                  </label>
                  <input aria-label="Nombre de la Prenda"
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
                  <select aria-label="Marca"
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
                  <select aria-label="Proveedor Habitual"
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
                    <input aria-label="Registrar Proveedor que no está en el sistema"
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
                    <input aria-label="Teléfono WhatsApp"
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

              {/* Fotos y variantes: cada una se gestiona en su propio panel */}
              <div id="edicion-talles" className="scroll-mt-32 sm:scroll-mt-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Images className="w-4 h-4 text-slate-500" /> Fotos y variantes
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(() => {
                    const totalFotos = (galeria?.colores ?? []).reduce(
                      (acc, c) => acc + c.fotos.length,
                      0
                    );
                    const coloresConFotos = (galeria?.colores ?? []).filter(
                      (c) => c.fotos.length > 0
                    ).length;
                    return (
                      <button
                        type="button"
                        onClick={() => setPanelFotos({})}
                        className="group text-left p-4 rounded-2xl border border-slate-200 bg-white hover:border-rose-300 hover:shadow-md active:scale-[0.99] transition cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-12 h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Camera className="w-6 h-6" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-base font-extrabold text-slate-900">
                              Gestionar fotos
                            </div>
                            <div className="text-xs text-slate-500">
                              {cargandoGaleria && !galeria
                                ? 'Cargando fotos…'
                                : faltaActualizarBase
                                  ? 'Falta actualizar la base de datos'
                                  : totalFotos === 0
                                    ? 'Sin fotos todavía'
                                    : `${totalFotos} ${totalFotos === 1 ? 'foto' : 'fotos'} en ${coloresConFotos} ${coloresConFotos === 1 ? 'color' : 'colores'}`}
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-rose-600 transition shrink-0" />
                        </div>
                        {/* Portada de cada color */}
                        <div className="mt-3 flex gap-2 overflow-hidden">
                          {coloresEnEdicion.slice(0, 5).map((c) => {
                            const fotosColor =
                              galeria?.colores.find((g) => g.codColor === c.codColor)?.fotos ?? [];
                            return (
                              <span
                                key={c.codColor}
                                className="relative w-12 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0"
                                title={`${c.nombreColor}: ${fotosColor.length} foto(s)`}
                              >
                                {fotosColor[0] ? (
                                  <ImagenProducto
                                    src={fotosColor[0].url}
                                    alt=""
                                    fill
                                    sizes="48px"
                                    className="object-cover"
                                  />
                                ) : (
                                  <ImageIcon className="absolute inset-0 m-auto w-4 h-4 text-slate-300" />
                                )}
                                <span
                                  className="absolute bottom-1 left-1 w-3 h-3 rounded-full border border-white shadow"
                                  style={{
                                    backgroundColor: mapearTextoAColorHex(c.nombreColor, c.codigoHex),
                                  }}
                                />
                              </span>
                            );
                          })}
                          {coloresEnEdicion.length > 5 && (
                            <span className="w-12 h-14 rounded-lg bg-slate-100 text-xs font-bold text-slate-600 flex items-center justify-center shrink-0">
                              +{coloresEnEdicion.length - 5}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })()}

                  {(() => {
                    const stockTotal = productoEditando.variantes.reduce(
                      (acc, v) => acc + (Number(v.stock) || 0),
                      0
                    );
                    const criticas = productoEditando.variantes.filter((v) => v.stock < 3).length;
                    return (
                      <button
                        type="button"
                        onClick={() => setPanelVariantes(true)}
                        className="group text-left p-4 rounded-2xl border border-slate-200 bg-white hover:border-rose-300 hover:shadow-md active:scale-[0.99] transition cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Layers className="w-6 h-6" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-base font-extrabold text-slate-900">
                              Gestionar variantes
                            </div>
                            <div className="text-xs text-slate-500">
                              {productoEditando.variantes.length}{' '}
                              {productoEditando.variantes.length === 1 ? 'variante' : 'variantes'} ·{' '}
                              {stockTotal} u. en stock
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-rose-600 transition shrink-0" />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {variantesSinGuardar && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-700">
                              Cambios sin guardar
                            </span>
                          )}
                          {criticas > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-300 text-[11px] font-bold text-amber-900">
                              <AlertTriangle className="w-3 h-3" /> {criticas} con stock bajo
                            </span>
                          )}
                          {coloresEnEdicion.slice(0, 3).map((c) => (
                            <span
                              key={c.codColor}
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-700"
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-black/10 dark:border-white/40"
                                style={{
                                  backgroundColor: mapearTextoAColorHex(c.nombreColor, c.codigoHex),
                                }}
                              />
                              {c.nombreColor}: {c.talles.join(', ')}
                            </span>
                          ))}
                          {coloresEnEdicion.length > 3 && (
                            <span className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-600">
                              +{coloresEnEdicion.length - 3} colores
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })()}
                </div>
              </div>

              <div className="max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:-mx-4 max-sm:px-4 max-sm:pb-safe-4 bg-white flex flex-wrap items-center justify-end gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={eliminarProducto}
                  disabled={eliminando || guardando}
                  aria-label="Eliminar prenda"
                  className="mr-auto inline-flex items-center justify-center gap-1.5 min-h-12 min-w-12 sm:min-h-0 sm:min-w-0 px-3 sm:px-4 py-2 rounded-xl border border-rose-200 text-sm font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    {eliminando ? 'Eliminando...' : 'Eliminar prenda'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setProductoEditando(null)}
                  className="min-h-12 sm:min-h-0 px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="max-sm:flex-1 min-h-12 sm:min-h-0 px-5 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition cursor-pointer disabled:opacity-50"
                >
                  {guardando ? (
                    'Guardando...'
                  ) : (
                    <>
                      <span className="sm:hidden">Guardar cambios</span>
                      <span className="hidden sm:inline">Guardar Cambios de la Prenda</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {productoEditando && (
        <>
          <GestionFotosSheet
            abierto={panelFotos !== null}
            onCerrar={() => setPanelFotos(null)}
            codProducto={productoEditando.codProducto}
            nombreProducto={productoEditando.nombre}
            colores={coloresEnEdicion}
            galeria={galeria}
            cargando={cargandoGaleria}
            error={errorGaleria}
            faltaActualizarBase={faltaActualizarBase}
            onReintentar={recargarGaleria}
            onGaleriaActualizada={alActualizarGaleria}
            codColorInicial={panelFotos?.codColor}
          />
          <GestionVariantesSheet
            abierto={panelVariantes}
            onCerrar={() => setPanelVariantes(false)}
            nombreProducto={productoEditando.nombre}
            variantes={productoEditando.variantes}
            onCambiar={(nuevas) =>
              setProductoEditando((prev) =>
                prev ? { ...prev, variantes: nuevas as ProductoCat['variantes'] } : prev
              )
            }
            originales={productoOriginal?.variantes ?? []}
            talles={talles}
            colores={colores}
            onCrearColor={crearColor}
            galeria={galeria}
            onGestionarFotos={(codColor) => {
              setPanelVariantes(false);
              setPanelFotos({ codColor });
            }}
          />
        </>
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
