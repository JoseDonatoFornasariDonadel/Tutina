'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { LogoDual } from '@/components/LogoDual';
import {
  Search,
  ShoppingBag,
  MessageCircle,
  Sparkles,
  Check,
  Plus,
  Minus,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Menu,
  Layers,
  MapPin,
  Instagram,
  Sun,
  Moon,
  ExternalLink,
  SlidersHorizontal,
} from 'lucide-react';
import { useAppConfig } from '@/components/layout/AppShell';
import { ImagenProducto } from '@/components/tienda/ImagenProducto';
import { SkeletonGrillaProductos } from '@/components/tienda/TiendaSkeleton';
import { mapearTextoAColorHex } from '@/lib/colores';
import type { VidrieraPublica } from '@/lib/services/tienda.service';

interface VariantePublica {
  codVariante: number;
  sku: string;
  stock: number;
  imagenVariante?: string | null;
  talle: {
    codTalle: number;
    nombreTalle: string;
    ordenVisualizacion: number;
  };
  color: {
    codColor: number;
    nombreColor: string;
    codigoHex: string;
  };
}

interface ProductoPublico {
  codProducto: number;
  nombre: string;
  descripcion: string;
  imagen: string;
  precioLista: number;
  porcentajeDescuento: number;
  nombrePromo?: string | null;
  precioFinal: number;
  marca: { codMarca: number; nombreMarca: string };
  categoria: { codCategoria: number; nombreCategoria: string };
  temporadas: { anio: number; nombreTemporada: string }[];
  variantes: VariantePublica[];
}

interface TiendaPublicaInfo {
  nombreComercial: string;
  logoUrl: string;
  logoDarkUrl?: string | null;
  slogan: string;
  telefonoWhatsApp: string;
  direccionComercial?: string | null;
  instagramHandle?: string | null;
}

interface ItemConsultaWsp {
  codVariante: number;
  codProducto: number;
  nombreProducto: string;
  nombreMarca: string;
  nombreTalle: string;
  nombreColor: string;
  codigoHex: string;
  precioUnitario: number;
  cantidad: number;
  stockMax: number;
  imagen: string;
}

const PRENDAS_POR_PAGINA = 12;

function resolverInstagram(valor?: string | null): { url: string; etiqueta: string } | null {
  if (!valor || !valor.trim()) return null;
  const limpio = valor.trim();

  // Si pegaron una URL completa (ej: https://www.instagram.com/tutina.indumentaria)
  if (limpio.startsWith('http://') || limpio.startsWith('https://')) {
    const sinBarraFinal = limpio.replace(/\/+$/, '');
    const partes = sinBarraFinal.split('/');
    const ultimoSegmento = partes[partes.length - 1] || 'Instagram';
    const etiqueta = ultimoSegmento.startsWith('@') ? ultimoSegmento : `@${ultimoSegmento}`;
    return { url: limpio, etiqueta };
  }

  // Si pegaron instagram.com/... sin https://
  if (limpio.toLowerCase().startsWith('instagram.com/') || limpio.toLowerCase().startsWith('www.instagram.com/')) {
    const url = `https://${limpio}`;
    const sinBarraFinal = limpio.replace(/\/+$/, '');
    const partes = sinBarraFinal.split('/');
    const ultimoSegmento = partes[partes.length - 1] || 'Instagram';
    return { url, etiqueta: `@${ultimoSegmento.replace(/^@/, '')}` };
  }

  // Si escribieron @usuario o usuario
  const handleSinArroba = limpio.replace(/^@/, '');
  return {
    url: `https://www.instagram.com/${handleSinArroba}`,
    etiqueta: `@${handleSinArroba}`,
  };
}

function resolverDireccionMaps(valor?: string | null): { url: string; etiqueta: string } | null {
  if (!valor || !valor.trim()) return null;
  const limpio = valor.trim();

  // Si usaron formato "Texto de dirección | https://maps..."
  if (limpio.includes('|')) {
    const [texto, link] = limpio.split('|').map((s) => s.trim());
    if (link && (link.startsWith('http://') || link.startsWith('https://'))) {
      return { url: link, etiqueta: texto || 'Ver ubicación en Google Maps' };
    }
  }

  // Si pegaron directamente un link de Google Maps (ej: https://maps.app.goo.gl/...)
  if (limpio.startsWith('http://') || limpio.startsWith('https://')) {
    return { url: limpio, etiqueta: 'Ver ubicación en Google Maps' };
  }

  // Si escribieron la dirección en texto, generamos la búsqueda directa en Google Maps
  return {
    url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(limpio)}`,
    etiqueta: limpio,
  };
}

interface ColorUnicoProducto {
  codColor: number;
  nombreColor: string;
  codigoHex: string;
  imagenColor: string | null;
  stockTotalColor: number;
}

function obtenerColoresUnicosProducto(prod: ProductoPublico): ColorUnicoProducto[] {
  const vistos = new Set<number>();
  const colores: ColorUnicoProducto[] = [];

  for (const v of prod.variantes) {
    const codColor = v.color.codColor;
    if (!vistos.has(codColor)) {
      vistos.add(codColor);
      const variantesDelColor = prod.variantes.filter((x) => x.color.codColor === codColor);
      const conImagen = variantesDelColor.find(
        (x) => x.imagenVariante && x.imagenVariante.trim() !== ''
      );
      const stockTotalColor = variantesDelColor.reduce((acc, x) => acc + x.stock, 0);
      colores.push({
        codColor,
        nombreColor: v.color.nombreColor,
        codigoHex: mapearTextoAColorHex(v.color.nombreColor, v.color.codigoHex),
        imagenColor: conImagen?.imagenVariante ?? null,
        stockTotalColor,
      });
    }
  }

  return colores;
}

function colorInicialPorProducto(listaProds: ProductoPublico[]): Record<number, number> {
  const seleccion: Record<number, number> = {};
  for (const p of listaProds) {
    if (p.variantes.length > 0) {
      // Color de la primera variante disponible por defecto
      const primeraDisponible = p.variantes.find((v) => v.stock > 0) || p.variantes[0];
      seleccion[p.codProducto] = primeraDisponible.color.codColor;
    }
  }
  return seleccion;
}

function varianteInicialPorProducto(listaProds: ProductoPublico[]): Record<number, number> {
  const seleccion: Record<number, number> = {};
  for (const p of listaProds) {
    if (p.variantes.length > 0) {
      const primeraDisponible = p.variantes.find((v) => v.stock > 0) || p.variantes[0];
      const codColorInicial = primeraDisponible.color.codColor;
      const conStockDelColor = p.variantes.find(
        (v) => v.color.codColor === codColorInicial && v.stock > 0
      );
      seleccion[p.codProducto] = conStockDelColor ? conStockDelColor.codVariante : 0;
    }
  }
  return seleccion;
}

export function TiendaCliente({ datosIniciales }: { datosIniciales: VidrieraPublica | null }) {
  const { darkMode, toggleDarkMode } = useAppConfig();

  // Datos de la primera página que ya vienen renderizados desde el servidor (ISR)
  const productosIniciales = (datosIniciales?.productos ?? []) as ProductoPublico[];

  const [tienda, setTienda] = useState<TiendaPublicaInfo>(
    datosIniciales?.tienda ?? {
      nombreComercial: 'Tutina',
      logoUrl: '/tutina-logo.svg',
      slogan: 'Indumentaria Deportiva & Urbana',
      telefonoWhatsApp: '+5493516543210',
      direccionComercial: 'Av. Hipólito Yrigoyen 450, Córdoba',
      instagramHandle: '@tutina.indumentaria',
    }
  );

  const [productos, setProductos] = useState<ProductoPublico[]>(productosIniciales);
  const [categorias, setCategorias] = useState<{ codCategoria: number; nombreCategoria: string }[]>(
    datosIniciales?.categorias ?? []
  );
  const [loading, setLoading] = useState(!datosIniciales);
  const versionDatos = datosIniciales?.generadoEn ?? '';

  // Filtros, Barra Lateral y Paginación
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS');
  const [orden, setOrden] = useState('MAS_RECIENTES');
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(datosIniciales?.pagination.totalPages ?? 1);
  const [totalItems, setTotalItems] = useState(datosIniciales?.pagination.totalItems ?? 0);
  const [sidebarMovilAbierta, setSidebarMovilAbierta] = useState(false);
  const [categoriasDesplegado, setCategoriasDesplegado] = useState(true);

  // Selección de color activo (codColor) y variante activa (codVariante) por cada producto
  const [colorSeleccionadoPorProd, setColorSeleccionadoPorProd] = useState<Record<number, number>>(
    () => colorInicialPorProducto(productosIniciales)
  );
  const [varianteSeleccionadaPorProd, setVarianteSeleccionadaPorProd] = useState<
    Record<number, number>
  >(() => varianteInicialPorProducto(productosIniciales));

  // Bolsa de Consulta por WhatsApp (Permite consultar por varias prendas juntas sin registrarse)
  const [bolsaConsulta, setBolsaConsulta] = useState<ItemConsultaWsp[]>([]);
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const [nombreClienteOpcional, setNombreClienteOpcional] = useState('');
  const [comentarioOpcional, setComentarioOpcional] = useState('');
  const [agregadoFeedback, setAgregadoFeedback] = useState<number | null>(null);

  // Modal de vista ampliada de prenda
  const [productoDetalleModal, setProductoDetalleModal] = useState<ProductoPublico | null>(null);

  const cargarVidriera = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(paginaActual),
        limit: String(PRENDAS_POR_PAGINA),
        orden,
      });
      if (busqueda.trim()) params.set('q', busqueda.trim());
      if (filtroCategoria !== 'TODAS') params.set('codCategoria', filtroCategoria);
      // La CDN guarda cada consulta 60 s. Con la versión de los datos en la URL, después de
      // un cambio en el catálogo (categoría nueva, prenda movida) se piden datos nuevos.
      if (versionDatos) params.set('v', versionDatos);

      const res = await fetch(`/api/tienda?${params.toString()}`);
      const data = await res.json();

      if (data.tienda) setTienda(data.tienda);
      const listaProds: ProductoPublico[] = data.productos || [];
      setProductos(listaProds);
      setCategorias(data.categorias || []);
      setTotalPaginas(data.pagination?.totalPages ?? 1);
      setTotalItems(data.pagination?.totalItems ?? listaProds.length);

      // Inicializar el color y la primera variante con stock por cada prenda
      setColorSeleccionadoPorProd((prev) => {
        const next = { ...prev };
        for (const p of listaProds) {
          if (!next[p.codProducto] && p.variantes.length > 0) {
            const primeraDisponible = p.variantes.find((v) => v.stock > 0) || p.variantes[0];
            next[p.codProducto] = primeraDisponible.color.codColor;
          }
        }
        return next;
      });
      setVarianteSeleccionadaPorProd((prev) => {
        const next = { ...prev };
        for (const p of listaProds) {
          if (next[p.codProducto] === undefined && p.variantes.length > 0) {
            const primeraDisponible = p.variantes.find((v) => v.stock > 0) || p.variantes[0];
            const codColorInicial = primeraDisponible.color.codColor;
            const conStockDelColor = p.variantes.find(
              (v) => v.color.codColor === codColorInicial && v.stock > 0
            );
            next[p.codProducto] = conStockDelColor ? conStockDelColor.codVariante : 0;
          }
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [paginaActual, orden, busqueda, filtroCategoria, versionDatos]);

  // La primera página ya llegó desde el servidor: no se vuelve a pedir al montar
  const omitirPrimeraCarga = useRef(Boolean(datosIniciales));
  useEffect(() => {
    if (omitirPrimeraCarga.current) {
      omitirPrimeraCarga.current = false;
      return;
    }
    cargarVidriera();
  }, [cargarVidriera]);

  const seleccionarColorProducto = (prod: ProductoPublico, codColor: number) => {
    setColorSeleccionadoPorProd((prev) => ({
      ...prev,
      [prod.codProducto]: codColor,
    }));
    const variantesDelColor = prod.variantes.filter((v) => v.color.codColor === codColor);
    const primeraConStock = variantesDelColor.find((v) => v.stock > 0);
    setVarianteSeleccionadaPorProd((prev) => ({
      ...prev,
      [prod.codProducto]: primeraConStock ? primeraConStock.codVariante : 0,
    }));
  };

  const obtenerEstadoSeleccionProducto = (prod: ProductoPublico) => {
    const coloresUnicos = obtenerColoresUnicosProducto(prod);
    const codColorElegido =
      colorSeleccionadoPorProd[prod.codProducto] ?? coloresUnicos[0]?.codColor ?? 0;
    const colorActivo =
      coloresUnicos.find((c) => c.codColor === codColorElegido) || coloresUnicos[0];

    const variantesDelColor = prod.variantes.filter(
      (v) => v.color.codColor === (colorActivo?.codColor ?? codColorElegido)
    );

    const idVarSel = varianteSeleccionadaPorProd[prod.codProducto];
    const varianteActiva =
      variantesDelColor.find((v) => v.codVariante === idVarSel && v.stock > 0) ||
      variantesDelColor.find((v) => v.stock > 0) ||
      undefined;

    const imagenMostrar =
      (varianteActiva?.imagenVariante && varianteActiva.imagenVariante.trim() !== ''
        ? varianteActiva.imagenVariante
        : null) ||
      colorActivo?.imagenColor ||
      prod.imagen;

    return {
      coloresUnicos,
      colorActivo,
      variantesDelColor,
      varianteActiva,
      imagenMostrar,
    };
  };

  // Construir link directo de WhatsApp para una sola prenda + talle + color
  const armarLinkWhatsAppIndividual = (prod: ProductoPublico, variante?: VariantePublica) => {
    const telefonoLimpio = (tienda.telefonoWhatsApp || '').replace(/[^0-9]/g, '');
    const talleTexto = variante ? variante.talle.nombreTalle : 'A confirmar';
    const colorTexto = variante ? variante.color.nombreColor : 'A confirmar';
    const precioTexto = `$${prod.precioFinal.toLocaleString('es-AR')}`;

    const mensaje = [
      `¡Hola ${tienda.nombreComercial}! 👋 Vi el catálogo web y quería consultar por esta prenda:`,
      ``,
      `• *Prenda:* ${prod.nombre}`,
      `• *Talle:* ${talleTexto}`,
      `• *Color:* ${colorTexto}`,
      `• *Precio:* ${precioTexto}${
        prod.porcentajeDescuento > 0 ? ` (${prod.porcentajeDescuento}% OFF incluido)` : ''
      }`,
      ``,
      `¿Tienen disponibilidad? ¡Muchas gracias!`,
    ].join('\n');

    return `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`;
  };

  // Agregar prenda con su Talle y Color a la Bolsa de Consulta
  const agregarABolsaConsulta = (prod: ProductoPublico, variante?: VariantePublica) => {
    if (!variante || variante.stock <= 0) return;

    const imagenMostrar =
      variante.imagenVariante && variante.imagenVariante.trim() !== ''
        ? variante.imagenVariante
        : prod.imagen;

    setBolsaConsulta((prev) => {
      const existe = prev.find((it) => it.codVariante === variante.codVariante);
      if (existe) {
        return prev.map((it) =>
          it.codVariante === variante.codVariante
            ? { ...it, cantidad: Math.min(it.stockMax, it.cantidad + 1) }
            : it
        );
      }
      return [
        ...prev,
        {
          codVariante: variante.codVariante,
          codProducto: prod.codProducto,
          nombreProducto: prod.nombre,
          nombreMarca: prod.marca.nombreMarca,
          nombreTalle: variante.talle.nombreTalle,
          nombreColor: variante.color.nombreColor,
          codigoHex: variante.color.codigoHex,
          precioUnitario: prod.precioFinal,
          cantidad: 1,
          stockMax: variante.stock,
          imagen: imagenMostrar,
        },
      ];
    });

    setAgregadoFeedback(prod.codProducto);
    setTimeout(() => {
      setAgregadoFeedback((curr) => (curr === prod.codProducto ? null : curr));
    }, 1500);
  };

  const cambiarCantidadBolsa = (codVariante: number, delta: number) => {
    setBolsaConsulta((prev) =>
      prev
        .map((it) => {
          if (it.codVariante !== codVariante) return it;
          const nueva = it.cantidad + delta;
          if (nueva <= 0) return null;
          return { ...it, cantidad: Math.min(it.stockMax, nueva) };
        })
        .filter(Boolean) as ItemConsultaWsp[]
    );
  };

  const quitarDeBolsa = (codVariante: number) => {
    setBolsaConsulta((prev) => prev.filter((it) => it.codVariante !== codVariante));
  };

  const totalUnidadesBolsa = bolsaConsulta.reduce((acc, it) => acc + it.cantidad, 0);
  const totalMontoBolsa = bolsaConsulta.reduce(
    (acc, it) => acc + it.precioUnitario * it.cantidad,
    0
  );

  // Construir link de WhatsApp para toda la Bolsa de Consulta
  const armarLinkWhatsAppBolsa = () => {
    const telefonoLimpio = (tienda.telefonoWhatsApp || '').replace(/[^0-9]/g, '');
    const saludoNombre = nombreClienteOpcional.trim()
      ? `¡Hola ${tienda.nombreComercial}! 👋 Soy *${nombreClienteOpcional.trim()}*.`
      : `¡Hola ${tienda.nombreComercial}! 👋`;

    const lineasItems = bolsaConsulta.map(
      (it) =>
        `• *${it.cantidad}x ${it.nombreProducto}* — Talle: *${
          it.nombreTalle
        }* | Color: *${it.nombreColor}* — $${(it.precioUnitario * it.cantidad).toLocaleString(
          'es-AR'
        )}`
    );

    const bloques = [
      saludoNombre,
      `Armé esta selección en el catálogo web y quería consultar disponibilidad para coordinar la compra:`,
      ``,
      ...lineasItems,
      ``,
      `*Total estimado:* $${totalMontoBolsa.toLocaleString('es-AR')} (${totalUnidadesBolsa} ${
        totalUnidadesBolsa === 1 ? 'prenda' : 'prendas'
      })`,
    ];

    if (comentarioOpcional.trim()) {
      bloques.push(`*Nota:* ${comentarioOpcional.trim()}`);
    }

    bloques.push(``, `¡Muchas gracias!`);

    return `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(bloques.join('\n'))}`;
  };

  const categoriaActivaNombre =
    filtroCategoria === 'TODAS'
      ? 'Todas las Prendas'
      : categorias.find((c) => String(c.codCategoria) === filtroCategoria)?.nombreCategoria ||
        'Categoría';

  const renderBarraLateralFiltros = (esMovil: boolean) => (
    <div className="space-y-5">
      {/* Cabecera de la Barra Lateral */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-rose-600" />
          <h2 className="text-sm font-extrabold text-slate-900">Filtros del Catálogo</h2>
        </div>
        {esMovil && (
          <button
            type="button"
            onClick={() => setSidebarMovilAbierta(false)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Desplegable de Categorías */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden">
        <button
          type="button"
          onClick={() => setCategoriasDesplegado((prev) => !prev)}
          className="w-full px-3.5 py-3 flex items-center justify-between text-left bg-white border-b border-slate-100 hover:bg-slate-50 transition cursor-pointer"
        >
          <div className="min-w-0">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-rose-600 shrink-0" /> Categorías
            </span>
            <span className="text-[11px] font-semibold text-rose-600 truncate block mt-0.5">
              {categoriaActivaNombre}
            </span>
          </div>
          {categoriasDesplegado ? (
            <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
          )}
        </button>

        {categoriasDesplegado && (
          <div className="p-2.5 space-y-1">
            <button
              type="button"
              onClick={() => {
                setFiltroCategoria('TODAS');
                setPaginaActual(1);
                if (esMovil) setSidebarMovilAbierta(false);
              }}
              className={`nav-sidebar-item w-full text-left px-3 py-2 rounded-xl text-xs font-bold border-2 transition cursor-pointer flex items-center justify-between ${
                filtroCategoria === 'TODAS'
                  ? 'bg-rose-600 border-rose-600 text-white shadow-2xs'
                  : 'border-transparent text-slate-700'
              }`}
            >
              <span>Todas las Prendas</span>
              {filtroCategoria === 'TODAS' && <Check className="w-3.5 h-3.5 shrink-0" />}
            </button>

            {categorias.map((cat) => {
              const activa = filtroCategoria === String(cat.codCategoria);
              return (
                <button
                  key={cat.codCategoria}
                  type="button"
                  onClick={() => {
                    setFiltroCategoria(String(cat.codCategoria));
                    setPaginaActual(1);
                    if (esMovil) setSidebarMovilAbierta(false);
                  }}
                  className={`nav-sidebar-item w-full text-left px-3 py-2 rounded-xl text-xs font-bold border-2 transition cursor-pointer flex items-center justify-between ${
                    activa
                      ? 'bg-rose-600 border-rose-600 text-white shadow-2xs'
                      : 'border-transparent text-slate-700'
                  }`}
                >
                  <span className="truncate">{cat.nombreCategoria}</span>
                  {activa && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selector de Orden */}
      <div className="space-y-1.5">
        <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
          Ordenar Prendas
        </label>
        <select
          value={orden}
          onChange={(e) => {
            setOrden(e.target.value);
            setPaginaActual(1);
            if (esMovil) setSidebarMovilAbierta(false);
          }}
          className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
        >
          <option value="MAS_RECIENTES">Más recientes primero</option>
          <option value="PRECIO_MENOR">Menor precio primero</option>
          <option value="PRECIO_MAYOR">Mayor precio primero</option>
          <option value="MAS_ANTIGUAS">Más antiguas primero</option>
        </select>
      </div>

      {/* Información del Catálogo */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-500">
        <div>
          Mostrando <strong>{productos.length}</strong> de <strong>{totalItems}</strong> prendas
          disponibles en catálogo.
        </div>
        <div className="pt-2 border-t border-slate-200/80 flex items-start gap-1.5 text-emerald-700 font-semibold leading-snug">
          <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Seleccioná Talle y Color en cada prenda para consultar por WhatsApp.</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Barra Superior Promocional */}
      <div className="bg-rose-600 text-white text-xs py-2 px-4 text-center font-medium">
        <span>
          ✨ Catálogo Online Oficial de <strong>{tienda.nombreComercial}</strong> • Elegí tu
          prenda, talle y color y consultanos directo por WhatsApp sin registrarte ✨
        </span>
      </div>

      {/* Header Público de la Tienda */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
          {/* Botón Menú Lateral Móvil + Logo e Identidad */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSidebarMovilAbierta(true)}
              title="Abrir categorías y filtros"
              className="lg:hidden p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-700 hover:border-rose-300 hover:text-rose-600 transition cursor-pointer shrink-0"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="h-9 sm:h-12 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
              <LogoDual
                logoUrl={tienda.logoUrl}
                logoDarkUrl={tienda.logoDarkUrl}
                alt={tienda.nombreComercial}
                className="h-6 sm:h-9 max-h-9 w-auto object-contain"
              />
            </div>
            <div className="hidden lg:block truncate">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  {tienda.nombreComercial}
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  Catálogo Oficial
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate">{tienda.slogan}</p>
            </div>
          </div>

          {/* Buscador Central Rápido Centrado */}
          <div className="flex-1 max-w-md mx-auto">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setPaginaActual(1);
                }}
                placeholder="Buscar prendas..."
                className="w-full pl-9 pr-7 py-2 rounded-full border border-slate-300 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-500 bg-slate-50"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => {
                    setBusqueda('');
                    setPaginaActual(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Acciones Derecha: Modo Oscuro y Símbolo de Consulta WhatsApp */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleDarkMode}
              title={darkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-600 transition cursor-pointer bg-slate-50/70"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setDrawerAbierto(true)}
              title="Mi Consulta WhatsApp"
              className="relative inline-flex items-center justify-center gap-2 p-2.5 md:px-4 md:py-2.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-bold hover:bg-emerald-700 transition shadow-xs cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden md:inline">Mi Consulta WhatsApp</span>
            </button>
          </div>
        </div>
      </header>

      {/* Barra Lateral Desplegable (Drawer) para Versión Móvil */}
      {sidebarMovilAbierta && (
        <div
          onClick={() => setSidebarMovilAbierta(false)}
          className="fixed inset-0 z-50 lg:hidden bg-slate-900/60 backdrop-blur-xs flex"
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="w-80 max-w-[85vw] bg-white h-full border-r border-slate-200 p-5 flex flex-col justify-between shadow-2xl overflow-y-auto"
          >
            {renderBarraLateralFiltros(true)}
          </aside>
        </div>
      )}

      {/* Contenido Principal del Catálogo Público: Barra Lateral Izquierda (Escritorio) + Grilla */}
      <div className="flex-1 w-full px-4 sm:px-6 lg:pl-6 lg:pr-6 py-6 flex flex-col lg:grid lg:grid-cols-[18rem_minmax(0,1fr)_18rem] gap-6 items-start">
        {/* Barra Lateral Izquierda Fija en Escritorio (pegada al borde izquierdo) */}
        <aside className="hidden lg:block w-72 shrink-0 sticky top-24 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          {renderBarraLateralFiltros(false)}
        </aside>

        {/* Columna Central: Grilla de Prendas y Paginación (centrada en el escritorio) */}
        <main className="min-w-0 w-full max-w-6xl mx-auto space-y-6">
          {/* Grilla de Prendas del Catálogo Público */}
          {loading ? (
            <SkeletonGrillaProductos />
          ) : productos.length === 0 ? (
            <div className="p-14 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
              <ShoppingBag className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-base font-bold text-slate-800">
                No encontramos prendas con esos filtros
              </p>
              <button
                type="button"
                onClick={() => {
                  setBusqueda('');
                  setFiltroCategoria('TODAS');
                  setPaginaActual(1);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
              >
                Ver todo el catálogo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {productos.map((prod, indiceProd) => {
              const {
                coloresUnicos,
                colorActivo,
                variantesDelColor,
                varianteActiva,
                imagenMostrar,
              } = obtenerEstadoSeleccionProducto(prod);
              const stockVariante = varianteActiva?.stock ?? 0;
              const sinStockVariante = !varianteActiva || stockVariante <= 0;
              const fueAgregadoRecien = agregadoFeedback === prod.codProducto;

              return (
                <div
                  key={prod.codProducto}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between group"
                >
                  <div>
                    {/* Imagen de la Prenda */}
                    <div
                      onClick={() => setProductoDetalleModal(prod)}
                      className="relative h-64 bg-slate-100 overflow-hidden cursor-pointer"
                    >
                      <ImagenProducto
                        src={imagenMostrar}
                        alt={prod.nombre}
                        fill
                        sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw"
                        priority={indiceProd < 3}
                        className="object-cover group-hover:scale-105 transition duration-300"
                      />

                      {/* Badges Superiores */}
                      <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-900/80 text-white backdrop-blur-xs">
                          {prod.categoria.nombreCategoria}
                        </span>
                        {prod.porcentajeDescuento > 0 && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-600 text-white shadow-xs">
                            -{prod.porcentajeDescuento}% OFF
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Cuerpo de la Tarjeta */}
                    <div className="p-4 space-y-3">
                      <div>
                        <h2
                          onClick={() => setProductoDetalleModal(prod)}
                          className="text-sm font-bold text-slate-900 line-clamp-1 hover:text-rose-600 cursor-pointer"
                        >
                          {prod.nombre}
                        </h2>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                          {prod.descripcion}
                        </p>
                      </div>

                      {/* Precio de Venta (Sin exponer jamás costo ni markup) */}
                      <div className="flex items-baseline gap-2 pt-1 border-t border-slate-100">
                        <span className="text-xl font-extrabold text-slate-900">
                          ${prod.precioFinal.toLocaleString('es-AR')}
                        </span>
                        {prod.porcentajeDescuento > 0 && (
                          <span className="text-xs text-slate-400 line-through font-medium">
                            ${prod.precioLista.toLocaleString('es-AR')}
                          </span>
                        )}
                      </div>

                      {/* Selector Dinámico de Color y Talles */}
                      <div className="space-y-2.5">
                        {/* 1. Selector de Color */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-700">
                              Color:{' '}
                              <strong className="text-slate-900">
                                {colorActivo?.nombreColor || 'Único'}
                              </strong>
                            </span>
                            <span
                              className={`font-semibold ${
                                stockVariante > 2
                                  ? 'text-emerald-700'
                                  : stockVariante > 0
                                  ? 'text-amber-700'
                                  : 'text-rose-600'
                              }`}
                            >
                              {stockVariante > 2
                                ? 'Disponible'
                                : stockVariante > 0
                                ? `¡Últimas ${stockVariante} u.!`
                                : 'Agotado'}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {coloresUnicos.map((c) => {
                              const esColorActivo = colorActivo?.codColor === c.codColor;
                              return (
                                <button
                                  key={c.codColor}
                                  type="button"
                                  onClick={() => seleccionarColorProducto(prod, c.codColor)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition cursor-pointer ${
                                    esColorActivo
                                      ? 'border-rose-600 bg-rose-50 text-rose-900 ring-1 ring-rose-500'
                                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                                  }`}
                                  title={`Ver en color ${c.nombreColor}`}
                                >
                                  <span
                                    className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0 shadow-2xs"
                                    style={{ backgroundColor: c.codigoHex }}
                                  />
                                  <span>{c.nombreColor}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 2. Talles disponibles para el color seleccionado */}
                        <div className="space-y-1">
                          <span className="block text-[11px] font-bold text-slate-700">
                            Talles para {colorActivo?.nombreColor || 'este color'}:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {variantesDelColor.map((v) => {
                              const agotada = v.stock <= 0;
                              const seleccionada =
                                !agotada && varianteActiva?.codVariante === v.codVariante;
                              return (
                                <button
                                  key={v.codVariante}
                                  type="button"
                                  disabled={agotada}
                                  onClick={() => {
                                    if (agotada) return;
                                    setVarianteSeleccionadaPorProd((prev) => ({
                                      ...prev,
                                      [prod.codProducto]: v.codVariante,
                                    }));
                                  }}
                                  title={
                                    agotada
                                      ? `Talle ${v.talle.nombreTalle} sin stock en ${v.color.nombreColor}`
                                      : `Talle ${v.talle.nombreTalle} (${v.stock} disponibles)`
                                  }
                                  className={`inline-flex items-center justify-center min-w-[2.25rem] px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                                    agotada
                                      ? 'border-slate-200 bg-slate-100 text-slate-400 line-through opacity-50 cursor-not-allowed'
                                      : seleccionada
                                      ? 'border-rose-600 bg-rose-600 text-white shadow-2xs cursor-pointer'
                                      : 'border-slate-200 bg-white text-slate-700 hover:border-rose-400 cursor-pointer'
                                  }`}
                                >
                                  {v.talle.nombreTalle}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Botones de Consulta por WhatsApp */}
                  <div className="p-4 pt-0 space-y-2">
                    <a
                      href={armarLinkWhatsAppIndividual(prod, varianteActiva)}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition shadow-xs"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Consultar por WhatsApp
                      <ExternalLink className="w-3 h-3 opacity-80" />
                    </a>

                    <button
                      type="button"
                      disabled={sinStockVariante}
                      onClick={() => agregarABolsaConsulta(prod, varianteActiva)}
                      className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        fueAgregadoRecien
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                      }`}
                    >
                      {fueAgregadoRecien ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> ¡Sumado a tu consulta!
                        </>
                      ) : sinStockVariante ? (
                        'Variante sin stock'
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" /> Sumar para consultar varias prendas
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Controles de Paginación (12 prendas por página) */}
        {totalPaginas > 1 && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              Página <strong>{paginaActual}</strong> de <strong>{totalPaginas}</strong> (
              {totalItems} prendas en total)
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={paginaActual <= 1}
                onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>

              {Array.from({ length: totalPaginas }, (_, idx) => idx + 1).map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPaginaActual(num)}
                  className={`w-8 h-8 rounded-xl text-xs font-bold transition cursor-pointer ${
                    paginaActual === num
                      ? 'bg-rose-600 text-white'
                      : 'border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {num}
                </button>
              ))}

              <button
                type="button"
                disabled={paginaActual >= totalPaginas}
                onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        </main>
      </div>

      {/* Pie de Página Público de la Tienda */}
      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-900 text-sm">{tienda.nombreComercial}</span>
            <span>• {tienda.slogan}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {(() => {
              const mapa = resolverDireccionMaps(tienda.direccionComercial);
              if (!mapa) return null;
              return (
                <a
                  href={mapa.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-slate-700 hover:text-rose-600 hover:underline transition"
                >
                  <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" /> {mapa.etiqueta}
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
              );
            })()}
            {(() => {
              const ig = resolverInstagram(tienda.instagramHandle);
              if (!ig) return null;
              return (
                <a
                  href={ig.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-rose-600 hover:text-rose-700 hover:underline transition"
                >
                  <Instagram className="w-3.5 h-3.5 text-rose-600" /> {ig.etiqueta}
                  <ExternalLink className="w-3 h-3 opacity-75" />
                </a>
              );
            })()}
            <Link
              href="/catalogo"
              className="text-[11px] text-slate-400 hover:text-rose-600 transition underline"
            >
              Acceso Administración
            </Link>
          </div>
        </div>
      </footer>

      {/* Botón Flotante Inferior cuando hay prendas en la Bolsa de Consulta */}
      {totalUnidadesBolsa > 0 && !drawerAbierto && (
        <div className="fixed bottom-5 right-5 z-40">
          <button
            type="button"
            onClick={() => setDrawerAbierto(true)}
            className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-emerald-600 text-white font-bold text-sm shadow-xl hover:bg-emerald-700 transition cursor-pointer"
          >
            <MessageCircle className="w-5 h-5" />
            <span>
              Enviar Consulta ({totalUnidadesBolsa}) • ${totalMontoBolsa.toLocaleString('es-AR')}
            </span>
          </button>
        </div>
      )}

      {/* Drawer Lateral: Bolsa de Consulta por WhatsApp */}
      {drawerAbierto && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md h-full flex flex-col justify-between shadow-2xl">
            {/* Cabecera del Drawer */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Sin registro • Directo al WhatsApp de {tienda.nombreComercial}
                </span>
                <h2 className="text-lg font-extrabold text-slate-900">
                  Tu Selección para Consultar
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDrawerAbierto(false)}
                className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lista de Prendas Seleccionadas */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {bolsaConsulta.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">
                    Todavía no sumaste prendas a tu consulta grupal
                  </p>
                  <p className="text-xs text-slate-500">
                    Podés tocar <strong>&ldquo;Consultar por WhatsApp&rdquo;</strong> directo en
                    cualquier prenda o sumar varias acá para enviarlas en un único mensaje.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {bolsaConsulta.map((item) => (
                      <div
                        key={item.codVariante}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <ImagenProducto
                            src={item.imagen}
                            alt={item.nombreProducto}
                            width={56}
                            height={56}
                            sizes="56px"
                            className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 truncate">
                              {item.nombreProducto}
                            </h4>
                            <p className="text-[11px] text-slate-600 mt-0.5">
                              Talle: <strong>{item.nombreTalle}</strong> • Color:{' '}
                              <strong>{item.nombreColor}</strong>
                            </p>
                            <p className="text-xs font-extrabold text-rose-600 mt-0.5">
                              ${(item.precioUnitario * item.cantidad).toLocaleString('es-AR')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => cambiarCantidadBolsa(item.codVariante, -1)}
                            className="w-7 h-7 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold">{item.cantidad}</span>
                          <button
                            type="button"
                            onClick={() => cambiarCantidadBolsa(item.codVariante, 1)}
                            className="w-7 h-7 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => quitarDeBolsa(item.codVariante)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Campos opcionales rápidos (sin registro) */}
                  <div className="pt-3 border-t border-slate-200 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Tu Nombre (Opcional, para el saludo de WhatsApp)
                      </label>
                      <input
                        type="text"
                        value={nombreClienteOpcional}
                        onChange={(e) => setNombreClienteOpcional(e.target.value)}
                        placeholder="Ej: Sofía"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Comentario o duda adicional (Opcional)
                      </label>
                      <input
                        type="text"
                        value={comentarioOpcional}
                        onChange={(e) => setComentarioOpcional(e.target.value)}
                        placeholder="Ej: ¿Puedo pasar a probarlas hoy a la tarde?"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Pie del Drawer con Botón de Envío a WhatsApp */}
            {bolsaConsulta.length > 0 && (
              <div className="p-5 border-t border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">
                    Total estimado ({totalUnidadesBolsa}{' '}
                    {totalUnidadesBolsa === 1 ? 'prenda' : 'prendas'}):
                  </span>
                  <span className="text-xl font-extrabold text-slate-900">
                    ${totalMontoBolsa.toLocaleString('es-AR')}
                  </span>
                </div>

                <a
                  href={armarLinkWhatsAppBolsa()}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition shadow-sm"
                >
                  <MessageCircle className="w-5 h-5" />
                  Enviar Pedido / Consulta por WhatsApp
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Vista Ampliada de Prenda */}
      {productoDetalleModal && (
        <div
          onClick={() => setProductoDetalleModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full overflow-hidden shadow-2xl grid grid-cols-1 md:grid-cols-2"
          >
            {(() => {
              const {
                coloresUnicos: coloresModal,
                colorActivo: colorModal,
                variantesDelColor: variantesDelColorModal,
                varianteActiva: varModal,
                imagenMostrar: imgModal,
              } = obtenerEstadoSeleccionProducto(productoDetalleModal);

              return (
                <>
                  <div className="relative h-72 md:h-full bg-slate-100">
                    <ImagenProducto
                      src={imgModal}
                      alt={`${productoDetalleModal.nombre} - ${colorModal?.nombreColor || ''}`}
                      fill
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="object-cover transition-all duration-300"
                    />
                  </div>

                  <div className="p-6 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[11px] font-bold text-rose-600 uppercase">
                            {productoDetalleModal.categoria.nombreCategoria}
                          </span>
                          <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                            {productoDetalleModal.nombre}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setProductoDetalleModal(null)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {productoDetalleModal.descripcion}
                      </p>

                      <div className="flex items-baseline gap-2 pt-2 border-t border-slate-100">
                        <span className="text-2xl font-extrabold text-slate-900">
                          ${productoDetalleModal.precioFinal.toLocaleString('es-AR')}
                        </span>
                        {productoDetalleModal.porcentajeDescuento > 0 && (
                          <span className="text-xs text-slate-400 line-through">
                            ${productoDetalleModal.precioLista.toLocaleString('es-AR')}
                          </span>
                        )}
                      </div>

                      {/* Selector de Color */}
                      <div className="space-y-2 pt-1">
                        <label className="block text-xs font-bold text-slate-700">
                          1. Color seleccionado:{' '}
                          <span className="text-rose-600">
                            {colorModal?.nombreColor || 'Único'}
                          </span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {coloresModal.map((c) => {
                            const esActivo = colorModal?.codColor === c.codColor;
                            return (
                              <button
                                key={c.codColor}
                                type="button"
                                onClick={() =>
                                  seleccionarColorProducto(productoDetalleModal, c.codColor)
                                }
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                                  esActivo
                                    ? 'border-rose-600 bg-rose-50 text-rose-900 ring-2 ring-rose-500/40'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                                }`}
                              >
                                <span
                                  className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs shrink-0"
                                  style={{ backgroundColor: c.codigoHex }}
                                />
                                <span>{c.nombreColor}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Selector de Talles exclusivos para el color seleccionado */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-slate-700">
                            2. Talles disponibles en {colorModal?.nombreColor || 'este color'}:
                          </label>
                          {varModal ? (
                            <span className="text-[11px] font-semibold text-emerald-700">
                              {varModal.stock} u. en stock
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-rose-600">
                              Sin stock en este color
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {variantesDelColorModal.map((v) => {
                            const agotada = v.stock <= 0;
                            const sel = !agotada && varModal?.codVariante === v.codVariante;
                            return (
                              <button
                                key={v.codVariante}
                                type="button"
                                disabled={agotada}
                                onClick={() => {
                                  if (agotada) return;
                                  setVarianteSeleccionadaPorProd((prev) => ({
                                    ...prev,
                                    [productoDetalleModal.codProducto]: v.codVariante,
                                  }));
                                }}
                                className={`inline-flex items-center justify-center gap-1.5 min-w-[3rem] px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                                  agotada
                                    ? 'border-slate-200 bg-slate-100 text-slate-400 line-through opacity-50 cursor-not-allowed'
                                    : sel
                                    ? 'border-rose-600 bg-rose-600 text-white shadow-xs cursor-pointer'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-rose-400 cursor-pointer'
                                }`}
                              >
                                <span>Talle {v.talle.nombreTalle}</span>
                                {agotada && <span className="text-[10px]">(Sin stock)</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-4 border-t border-slate-100">
                      <a
                        href={armarLinkWhatsAppIndividual(productoDetalleModal, varModal)}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Consultar esta prenda por WhatsApp
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        disabled={!varModal || varModal.stock <= 0}
                        onClick={() => {
                          agregarABolsaConsulta(productoDetalleModal, varModal);
                          setProductoDetalleModal(null);
                          setDrawerAbierto(true);
                        }}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs font-bold hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" /> Sumar a mi consulta grupal
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
