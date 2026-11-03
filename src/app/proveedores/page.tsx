'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Truck,
  FileText,
  Plus,
  Minus,
  CheckCircle2,
  Building2,
  Globe,
  Phone,
  Mail,
  Trash2,
  ArrowUpRight,
  Search,
  UserPlus,
  Edit3,
  ShoppingCart,
  PackagePlus,
  Filter,
  X,
  Tag,
  Upload,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { useAppConfig } from '@/components/layout/AppShell';
import {
  NuevaPrendaModal,
  type CantidadesPorVariante,
  type NuevoProductoCreado,
} from '@/components/catalogo/NuevaPrendaModal';
import type { ColorOpcion } from '@/components/catalogo/ColorSelector';
import { comprimirImagen } from '@/lib/comprimirImagen';
import { mapearTextoAColorHex } from '@/lib/colores';

interface Proveedor {
  codProveedor: number;
  nombreProveedor: string;
  webProveedor?: string | null;
  numeroProveedor: string;
  correoProveedor?: string | null;
  facturas?: { idFactura: number }[];
  productosHabituales?: { codProducto: number; nombre: string }[];
}

interface VarianteIngreso {
  codVariante: number;
  sku: string;
  stock: number;
  imagenVariante?: string | null;
  producto: {
    codProducto: number;
    nombre: string;
    imagen?: string;
    precioCosto: number;
    porcentajeMarkup: number;
    precio: number;
  };
  talle: { codTalle?: number; nombreTalle: string };
  color: { codColor?: number; nombreColor: string; codigoHex?: string };
}

interface ProductoCatModal {
  codProducto: number;
  nombre: string;
  descripcion: string;
  imagen: string;
  precioCosto: number;
  porcentajeMarkup: number;
  precio: number;
  codMarca: number;
  codCategoria: number;
  codProveedorHabitual: number | null;
  marca: { codMarca: number; nombreMarca: string };
  categoria: { codCategoria: number; nombreCategoria: string; markupPorDefectoCategoria?: number };
  variantes: {
    codVariante: number;
    sku: string;
    stock: number;
    imagenVariante?: string | null;
    talle: { codTalle: number; nombreTalle: string };
    color: { codColor: number; nombreColor: string; codigoHex: string };
  }[];
}

interface ItemCarritoFactura {
  codVariante: number;
  codProducto: number;
  sku: string;
  nombreProducto: string;
  imagen: string;
  marca: string;
  talle: string;
  color: string;
  codigoHex: string;
  stockActual: number;
  cantidadDI: number;
  precioIndividual: number;
}

interface FacturaHist {
  idFactura: number;
  nroFactura: string;
  fechaFactura: string;
  ivaFactura: number;
  costoTotal: number;
  tieneComprobante?: boolean;
  proveedor: { nombreProveedor: string };
  detallesIngreso: {
    idDetalleIngreso: number;
    cantidadDI: number;
    precioIndividual: number;
    subtotalDI: number;
    variante: {
      sku: string;
      producto: { nombre: string };
      talle: { nombreTalle: string };
      color: { nombreColor: string };
    };
  }[];
}

const MAX_BYTES_COMPROBANTE_PDF = 3 * 1024 * 1024;

export default function ProveedoresFacturasPage() {
  const { refreshGlobalState } = useAppConfig();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [facturas, setFacturas] = useState<FacturaHist[]>([]);
  const [variantes, setVariantes] = useState<VarianteIngreso[]>([]);
  const [loading, setLoading] = useState(true);

  // Datos de catálogo para el Modal "Selección Múltiple de Indumentaria (Carrito en Vivo)" y "Nueva Prenda"
  const [productosCat, setProductosCat] = useState<ProductoCatModal[]>([]);
  const [categoriasCat, setCategoriasCat] = useState<
    { codCategoria: number; nombreCategoria: string; markupPorDefectoCategoria?: number }[]
  >([]);
  const [marcasCat, setMarcasCat] = useState<{ codMarca: number; nombreMarca: string }[]>([]);
  const [temporadasCat, setTemporadasCat] = useState<
    { codTemporada: number; nombreTemporada: string }[]
  >([]);
  const [descuentosCat, setDescuentosCat] = useState<
    {
      codDescuento: number;
      nombreDesc: string;
      porcentajeDesc: number;
      fechaInicioDesc: string;
      fechaFinDesc: string;
    }[]
  >([]);
  const [tallesCat, setTallesCat] = useState<{ codTalle: number; nombreTalle: string }[]>([]);
  const [coloresCat, setColoresCat] = useState<ColorOpcion[]>([]);

  // Selector de Apartado: 'PROVEEDORES' | 'FACTURAS' | 'AMBOS'
  const [vistaActiva, setVistaActiva] = useState<'AMBOS' | 'PROVEEDORES' | 'FACTURAS'>('AMBOS');

  // Estado del Apartado de Registro de Proveedores
  const [busquedaProv, setBusquedaProv] = useState('');
  const [nuevoProvForm, setNuevoProvForm] = useState({
    nombreProveedor: '',
    numeroProveedor: '+54911',
    correoProveedor: '',
    webProveedor: '',
  });
  const [guardandoProv, setGuardandoProv] = useState(false);
  const [mensajeExitoProv, setMensajeExitoProv] = useState<string | null>(null);
  const [proveedorEditando, setProveedorEditando] = useState<Proveedor | null>(null);

  // Formulario de Nueva Factura / DetalleIngreso
  const [codProveedorSel, setCodProveedorSel] = useState<number>(0);
  const [nroFactura, setNroFactura] = useState('FC-A-0001-00004890');
  const [ivaFactura, setIvaFactura] = useState(21);
  const [comprobanteUrl, setComprobanteUrl] = useState<string>('');
  const [nombreArchivoComprobante, setNombreArchivoComprobante] = useState<string>('');
  const [procesandoComprobante, setProcesandoComprobante] = useState<boolean>(false);
  const [lineasIngreso, setLineasIngreso] = useState<
    { codVariante: number; cantidadDI: number; precioIndividual: number }[]
  >([]);
  const [guardandoFactura, setGuardandoFactura] = useState(false);

  // Estado del Modal "Selección Múltiple de Indumentaria (Carrito en Vivo)" y anidación de "Nueva Prenda"
  const [modalProductosAbierto, setModalProductosAbierto] = useState(false);
  const [modalNuevaPrendaAbierto, setModalNuevaPrendaAbierto] = useState(false);
  const [carritoModalEnVivo, setCarritoModalEnVivo] = useState<ItemCarritoFactura[]>([]);
  const [filtroModalTexto, setFiltroModalTexto] = useState('');
  const [filtroModalCategoria, setFiltroModalCategoria] = useState('TODAS');
  const [filtroModalMarca, setFiltroModalMarca] = useState('TODAS');
  const [filtroModalProveedor, setFiltroModalProveedor] = useState('TODOS');
  const [varianteSeleccionadaPorProd, setVarianteSeleccionadaPorProd] = useState<
    Record<number, number>
  >({});
  const [cantidadSeleccionadaPorProd, setCantidadSeleccionadaPorProd] = useState<
    Record<number, number>
  >({});

  // Resumen de impacto tras cargar factura
  const [resultadoImpacto, setResultadoImpacto] = useState<
    | {
        nombre: string;
        costoAnterior: number;
        costoNuevo: number;
        precioVentaAnterior: number;
        precioVentaNuevo: number;
        alertaReseteada: boolean;
      }[]
    | null
  >(null);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [provRes, catRes] = await Promise.all([
        fetch('/api/proveedores', { cache: 'no-store' }),
        // Modo ligero: fotos como URL en vez de base64 (el catálogo completo puede pesar mucho)
        fetch('/api/catalogo?all=true&ligero=1', { cache: 'no-store' }),
      ]);
      const data = await provRes.json();
      const catData = await catRes.json();

      setProveedores(data.proveedores || []);
      setFacturas(data.facturas || []);
      setVariantes(data.variantes || []);

      const prods: ProductoCatModal[] = catData.productos || [];
      setProductosCat(prods);
      setCategoriasCat(catData.categorias || []);
      setMarcasCat(catData.marcas || []);
      setTemporadasCat(catData.temporadas || []);
      setDescuentosCat(catData.descuentos || []);
      setTallesCat(catData.talles || []);
      setColoresCat(catData.colores || []);

      setVarianteSeleccionadaPorProd((prev) => {
        const next = { ...prev };
        for (const p of prods) {
          if (!next[p.codProducto] && p.variantes[0]) {
            next[p.codProducto] = p.variantes[0].codVariante;
          }
        }
        return next;
      });
      setCantidadSeleccionadaPorProd((prev) => {
        const next = { ...prev };
        for (const p of prods) {
          if (!next[p.codProducto]) {
            next[p.codProducto] = 6;
          }
        }
        return next;
      });

      if (data.proveedores?.[0] && !codProveedorSel) {
        setCodProveedorSel(data.proveedores[0].codProveedor);
      }
      if (data.variantes?.[0] && lineasIngreso.length === 0) {
        setLineasIngreso([
          {
            codVariante: data.variantes[0].codVariante,
            cantidadDI: 6,
            precioIndividual: data.variantes[0].producto.precioCosto,
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const proveedoresFiltrados = useMemo(() => {
    const q = busquedaProv.trim().toLowerCase();
    if (!q) return proveedores;
    return proveedores.filter(
      (p) =>
        p.nombreProveedor.toLowerCase().includes(q) ||
        p.numeroProveedor.toLowerCase().includes(q) ||
        (p.correoProveedor && p.correoProveedor.toLowerCase().includes(q))
    );
  }, [proveedores, busquedaProv]);

  // Construir ítem completo de carrito a partir de una línea de ingreso
  const construirItemCarritoDesdeVariante = (
    codVariante: number,
    cantidadDI: number,
    precioIndividual?: number
  ): ItemCarritoFactura | null => {
    for (const p of productosCat) {
      const v = p.variantes.find((x) => x.codVariante === codVariante);
      if (v) {
        return {
          codVariante: v.codVariante,
          codProducto: p.codProducto,
          sku: v.sku,
          nombreProducto: p.nombre,
          imagen: v.imagenVariante || p.imagen,
          marca: p.marca.nombreMarca,
          talle: v.talle.nombreTalle,
          color: v.color.nombreColor,
          codigoHex: mapearTextoAColorHex(v.color.nombreColor, v.color.codigoHex),
          stockActual: v.stock,
          cantidadDI,
          precioIndividual: precioIndividual ?? p.precioCosto,
        };
      }
    }
    const vSimple = variantes.find((x) => x.codVariante === codVariante);
    if (vSimple) {
      return {
        codVariante: vSimple.codVariante,
        codProducto: vSimple.producto.codProducto,
        sku: vSimple.sku,
        nombreProducto: vSimple.producto.nombre,
        imagen: vSimple.imagenVariante || vSimple.producto.imagen || '',
        marca: '',
        talle: vSimple.talle.nombreTalle,
        color: vSimple.color.nombreColor,
        codigoHex: mapearTextoAColorHex(vSimple.color.nombreColor, vSimple.color.codigoHex),
        stockActual: vSimple.stock,
        cantidadDI,
        precioIndividual: precioIndividual ?? vSimple.producto.precioCosto,
      };
    }
    return null;
  };

  // Abrir el Modal "Selección Múltiple de Indumentaria (Carrito en Vivo)" sincronizado con lineasIngreso
  const abrirModalSelectorProductos = () => {
    const itemsActuales = lineasIngreso
      .map((l) =>
        construirItemCarritoDesdeVariante(l.codVariante, l.cantidadDI, l.precioIndividual)
      )
      .filter(Boolean) as ItemCarritoFactura[];
    setCarritoModalEnVivo(itemsActuales);
    setModalProductosAbierto(true);
  };

  // Filtrado de prendas dentro del Modal de Selección Múltiple
  const productosFiltradosModal = useMemo(() => {
    return productosCat.filter((p) => {
      const q = filtroModalTexto.trim().toLowerCase();
      const coincideNombre =
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        p.variantes.some((v) => v.sku.toLowerCase().includes(q));
      const coincideCat =
        filtroModalCategoria === 'TODAS' || p.codCategoria === Number(filtroModalCategoria);
      const coincideMarca =
        filtroModalMarca === 'TODAS' || p.codMarca === Number(filtroModalMarca);
      const coincideProv =
        filtroModalProveedor === 'TODOS' ||
        p.codProveedorHabitual === Number(filtroModalProveedor);

      return coincideNombre && coincideCat && coincideMarca && coincideProv;
    });
  }, [
    productosCat,
    filtroModalTexto,
    filtroModalCategoria,
    filtroModalMarca,
    filtroModalProveedor,
  ]);

  const agregarAlCarritoFacturaEnVivo = (prod: ProductoCatModal) => {
    const codVarianteElegida =
      varianteSeleccionadaPorProd[prod.codProducto] ?? prod.variantes[0]?.codVariante;
    const variante = prod.variantes.find((v) => v.codVariante === codVarianteElegida);
    if (!variante) return;

    const cantSolicitada = Math.max(1, cantidadSeleccionadaPorProd[prod.codProducto] || 1);

    setCarritoModalEnVivo((prev) => {
      const existenteIdx = prev.findIndex((item) => item.codVariante === variante.codVariante);
      if (existenteIdx >= 0) {
        const copia = [...prev];
        copia[existenteIdx] = {
          ...copia[existenteIdx],
          cantidadDI: copia[existenteIdx].cantidadDI + cantSolicitada,
        };
        return copia;
      }

      return [
        ...prev,
        {
          codVariante: variante.codVariante,
          codProducto: prod.codProducto,
          sku: variante.sku,
          nombreProducto: prod.nombre,
          imagen: variante.imagenVariante || prod.imagen,
          marca: prod.marca.nombreMarca,
          talle: variante.talle.nombreTalle,
          color: variante.color.nombreColor,
          codigoHex: mapearTextoAColorHex(variante.color.nombreColor, variante.color.codigoHex),
          stockActual: variante.stock,
          cantidadDI: cantSolicitada,
          precioIndividual: prod.precioCosto,
        },
      ];
    });
  };

  const cambiarCantidadEnCarritoModal = (codVariante: number, delta: number) => {
    setCarritoModalEnVivo((prev) =>
      prev
        .map((it) => {
          if (it.codVariante !== codVariante) return it;
          const nueva = it.cantidadDI + delta;
          if (nueva <= 0) return null;
          return { ...it, cantidadDI: nueva };
        })
        .filter(Boolean) as ItemCarritoFactura[]
    );
  };

  const cambiarCostoEnCarritoModal = (codVariante: number, nuevoCosto: number) => {
    setCarritoModalEnVivo((prev) =>
      prev.map((it) =>
        it.codVariante === codVariante
          ? { ...it, precioIndividual: Math.max(0, nuevoCosto) }
          : it
      )
    );
  };

  const confirmarSeleccionModal = () => {
    setLineasIngreso(
      carritoModalEnVivo.map((it) => ({
        codVariante: it.codVariante,
        cantidadDI: it.cantidadDI,
        precioIndividual: it.precioIndividual,
      }))
    );
    setModalProductosAbierto(false);
  };

  // Al guardar una "Nueva Prenda" desde el modal superpuesto, inyectarla automáticamente en la factura
  const handleNuevaPrendaCreadaParaFactura = async (
    nuevoProd: NuevoProductoCreado,
    cantidadesPorVariante: CantidadesPorVariante
  ) => {
    // La prenda se creó con stock 0: la cantidad cargada entra recién con esta factura
    const cantidadDe = (codVariante: number) => Math.max(0, cantidadesPorVariante[codVariante] ?? 0);
    setModalNuevaPrendaAbierto(false);

    // 1. Incorporar el nuevo producto y sus variantes al estado local inmediatamente
    const prodModal: ProductoCatModal = {
      codProducto: nuevoProd.codProducto,
      nombre: nuevoProd.nombre,
      descripcion: nuevoProd.descripcion,
      imagen: nuevoProd.imagen,
      precioCosto: nuevoProd.precioCosto,
      porcentajeMarkup: nuevoProd.porcentajeMarkup,
      precio: nuevoProd.precio,
      codMarca: nuevoProd.codMarca,
      codCategoria: nuevoProd.codCategoria,
      codProveedorHabitual: nuevoProd.codProveedorHabitual,
      marca: nuevoProd.marca,
      categoria: nuevoProd.categoria,
      variantes: nuevoProd.variantes,
    };

    setProductosCat((prev) => [prodModal, ...prev]);

    const nuevasVariantesIngreso: VarianteIngreso[] = nuevoProd.variantes.map((v) => ({
      codVariante: v.codVariante,
      sku: v.sku,
      stock: v.stock,
      imagenVariante: v.imagenVariante,
      producto: {
        codProducto: nuevoProd.codProducto,
        nombre: nuevoProd.nombre,
        imagen: nuevoProd.imagen,
        precioCosto: nuevoProd.precioCosto,
        porcentajeMarkup: nuevoProd.porcentajeMarkup,
        precio: nuevoProd.precio,
      },
      talle: v.talle,
      color: v.color,
    }));

    setVariantes((prev) => [...nuevasVariantesIngreso, ...prev]);

    if (nuevoProd.variantes[0]) {
      setVarianteSeleccionadaPorProd((prev) => ({
        ...prev,
        [nuevoProd.codProducto]: nuevoProd.variantes[0].codVariante,
      }));
      setCantidadSeleccionadaPorProd((prev) => ({
        ...prev,
        [nuevoProd.codProducto]: Math.max(1, cantidadDe(nuevoProd.variantes[0].codVariante) || 1),
      }));
    }

    // 2. Construir los ítems de las variantes recién creadas e inyectarlos tanto en el carrito en vivo como en la factura
    const nuevosItemsCarrito: ItemCarritoFactura[] = nuevoProd.variantes
      .filter((v) => cantidadDe(v.codVariante) > 0)
      .map((v) => ({
      codVariante: v.codVariante,
      codProducto: nuevoProd.codProducto,
      sku: v.sku,
      nombreProducto: nuevoProd.nombre,
      imagen: v.imagenVariante || nuevoProd.imagen,
      marca: nuevoProd.marca.nombreMarca,
      talle: v.talle.nombreTalle,
      color: v.color.nombreColor,
      codigoHex: mapearTextoAColorHex(v.color.nombreColor, v.color.codigoHex),
      stockActual: v.stock,
      cantidadDI: cantidadDe(v.codVariante),
      precioIndividual: nuevoProd.precioCosto,
    }));

    setCarritoModalEnVivo((prev) => {
      const idsExistentes = new Set(prev.map((x) => x.codVariante));
      const filtrados = nuevosItemsCarrito.filter((x) => !idsExistentes.has(x.codVariante));
      return [...prev, ...filtrados];
    });

    setLineasIngreso((prev) => {
      const idsExistentes = new Set(prev.map((x) => x.codVariante));
      const nuevasLineas = nuevosItemsCarrito
        .filter((x) => !idsExistentes.has(x.codVariante))
        .map((x) => ({
          codVariante: x.codVariante,
          cantidadDI: x.cantidadDI,
          precioIndividual: x.precioIndividual,
        }));
      return [...prev, ...nuevasLineas];
    });

    await refreshGlobalState();
  };

  // Subida de comprobante de factura (PDF o imagen)
  const handleSubirComprobanteFactura = async (file?: File) => {
    if (!file) return;
    // Los PDF no se comprimen y viajan en base64 (un tercio más pesados): por encima de
    // ~3 MB la factura superaría el límite de 4,5 MB por petición de Vercel.
    if (!file.type.startsWith('image/') && file.size > MAX_BYTES_COMPROBANTE_PDF) {
      alert(
        `El PDF pesa ${(file.size / 1024 / 1024).toFixed(1)} MB. El máximo es 3 MB: ` +
          'probá con una versión comprimida o adjuntá una foto del comprobante.'
      );
      return;
    }
    setProcesandoComprobante(true);
    try {
      setNombreArchivoComprobante(file.name);
      if (file.type.startsWith('image/')) {
        const comprimida = await comprimirImagen(file);
        setComprobanteUrl(comprimida);
      } else {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
          reader.readAsDataURL(file);
        });
        setComprobanteUrl(dataUrl);
      }
    } catch {
      alert('No se pudo procesar el comprobante. Probá con otro archivo PDF o imagen.');
    } finally {
      setProcesandoComprobante(false);
    }
  };

  const handleCrearProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardandoProv(true);
    setMensajeExitoProv(null);
    try {
      const res = await fetch('/api/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'PROVEEDOR',
          ...nuevoProvForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar proveedor');

      setMensajeExitoProv(
        `¡Proveedor "${data.nombreProveedor}" registrado en el sistema y disponible para asociar a prendas y facturas!`
      );
      setNuevoProvForm({
        nombreProveedor: '',
        numeroProveedor: '+54911',
        correoProveedor: '',
        webProveedor: '',
      });
      setCodProveedorSel(data.codProveedor);
      await cargarDatos();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al registrar proveedor');
    } finally {
      setGuardandoProv(false);
    }
  };

  const handleGuardarEdicionProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proveedorEditando) return;
    const res = await fetch('/api/proveedores', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proveedorEditando),
    });
    if (res.ok) {
      setMensajeExitoProv(`Datos de "${proveedorEditando.nombreProveedor}" actualizados.`);
      setProveedorEditando(null);
      await cargarDatos();
    }
  };

  const handleDarBajaProveedor = async (codProveedor: number, nombre: string) => {
    if (!confirm(`¿Dar de baja lógica al proveedor "${nombre}"?`)) return;
    const res = await fetch(`/api/proveedores?codProveedor=${codProveedor}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      await cargarDatos();
    }
  };

  const handleRegistrarFactura = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lineasIngreso.length === 0) {
      alert('Seleccioná al menos una variante de prenda para registrar la factura.');
      return;
    }
    setGuardandoFactura(true);
    try {
      const res = await fetch('/api/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codProveedor: codProveedorSel,
          nroFactura,
          ivaFactura,
          comprobanteUrl: comprobanteUrl || null,
          detalles: lineasIngreso,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar factura');

      setResultadoImpacto(data.productosActualizados || []);
      setNroFactura(`FC-A-0001-0000${Math.floor(5000 + Math.random() * 4000)}`);
      setComprobanteUrl('');
      setNombreArchivoComprobante('');
      await cargarDatos();
      await refreshGlobalState();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al registrar factura');
    } finally {
      setGuardandoFactura(false);
    }
  };

  const costoTotalFactura = lineasIngreso.reduce(
    (acc, l) => acc + l.cantidadDI * l.precioIndividual,
    0
  );

  const totalCarritoModalEnVivo = useMemo(
    () => carritoModalEnVivo.reduce((acc, it) => acc + it.precioIndividual * it.cantidadDI, 0),
    [carritoModalEnVivo]
  );

  return (
    <div className="space-y-6">
      {/* Encabezado y Selector de Apartados */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Abastecimiento, Directorio de Proveedores & Facturas
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Gestión de Proveedores e Ingreso de Mercadería
          </h1>
          <p className="text-sm text-slate-500">
            Registra nuevos proveedores en el sistema, administra sus datos de contacto y carga sus
            facturas para actualizar stock y costos automáticamente.
          </p>
        </div>

        {/* Selector de Apartado */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 shrink-0 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setVistaActiva('AMBOS')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              vistaActiva === 'AMBOS'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Vista Completa
          </button>
          <button
            type="button"
            onClick={() => setVistaActiva('PROVEEDORES')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              vistaActiva === 'PROVEEDORES'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🏢 Registro de Proveedores ({proveedores.length})
          </button>
          <button
            type="button"
            onClick={() => setVistaActiva('FACTURAS')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              vistaActiva === 'FACTURAS'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📄 Carga de Facturas ({facturas.length})
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* APARTADO 1: REGISTRO Y DIRECTORIO DE PROVEEDORES                  */}
      {/* ================================================================= */}
      {(vistaActiva === 'AMBOS' || vistaActiva === 'PROVEEDORES') && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-rose-600" /> Apartado de Registro de Proveedores
              </h2>
              <p className="text-xs text-slate-500">
                Da de alta a los proveedores mayoristas o fabricantes que aún no están en el
                sistema.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busquedaProv}
                onChange={(e) => setBusquedaProv(e.target.value)}
                placeholder="Buscar proveedor registrado..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200"
              />
            </div>
          </div>

          {mensajeExitoProv && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {mensajeExitoProv}
              </span>
              <button
                onClick={() => setMensajeExitoProv(null)}
                className="underline ml-3 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          )}

          {/* Formulario permanente para Registrar Nuevo Proveedor */}
          <form
            onSubmit={handleCrearProveedor}
            className="p-5 rounded-2xl bg-rose-50/50 border border-rose-200/80 space-y-4"
          >
            <div className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Registrar Nuevo Proveedor en Tutina
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Nombre / Razón Social *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Textil Deportiva Norte S.A."
                  value={nuevoProvForm.nombreProveedor}
                  onChange={(e) =>
                    setNuevoProvForm({ ...nuevoProvForm, nombreProveedor: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Teléfono / WhatsApp (`numeroProveedor`) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="+54911..."
                  value={nuevoProvForm.numeroProveedor}
                  onChange={(e) =>
                    setNuevoProvForm({ ...nuevoProvForm, numeroProveedor: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Correo Electrónico (`correoProveedor`)
                </label>
                <input
                  type="email"
                  placeholder="ventas@proveedor.com.ar"
                  value={nuevoProvForm.correoProveedor}
                  onChange={(e) =>
                    setNuevoProvForm({ ...nuevoProvForm, correoProveedor: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Sitio Web / Catálogo (`webProveedor`)
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={nuevoProvForm.webProveedor}
                  onChange={(e) =>
                    setNuevoProvForm({ ...nuevoProvForm, webProveedor: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={guardandoProv}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition cursor-pointer shadow-2xs"
              >
                <UserPlus className="w-4 h-4" />
                {guardandoProv ? 'Registrando...' : 'Guardar Nuevo Proveedor'}
              </button>
            </div>
          </form>

          {/* Modal / Formulario de Edición de Proveedor Existente */}
          {proveedorEditando && (
            <form
              onSubmit={handleGuardarEdicionProveedor}
              className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-3"
            >
              <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                <span>Editando Proveedor #{proveedorEditando.codProveedor}</span>
                <button
                  type="button"
                  onClick={() => setProveedorEditando(null)}
                  className="text-slate-500 underline cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  value={proveedorEditando.nombreProveedor}
                  onChange={(e) =>
                    setProveedorEditando({
                      ...proveedorEditando,
                      nombreProveedor: e.target.value,
                    })
                  }
                  className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                />
                <input
                  type="text"
                  required
                  value={proveedorEditando.numeroProveedor}
                  onChange={(e) =>
                    setProveedorEditando({
                      ...proveedorEditando,
                      numeroProveedor: e.target.value,
                    })
                  }
                  className="px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 bg-white"
                />
                <input
                  type="email"
                  placeholder="Correo"
                  value={proveedorEditando.correoProveedor || ''}
                  onChange={(e) =>
                    setProveedorEditando({
                      ...proveedorEditando,
                      correoProveedor: e.target.value,
                    })
                  }
                  className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                />
                <input
                  type="text"
                  placeholder="Web"
                  value={proveedorEditando.webProveedor || ''}
                  onChange={(e) =>
                    setProveedorEditando({
                      ...proveedorEditando,
                      webProveedor: e.target.value,
                    })
                  }
                  className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                >
                  Actualizar Proveedor
                </button>
              </div>
            </form>
          )}

          {/* Grilla de Proveedores Registrados */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-600" /> Directorio de Proveedores Activos (
              {proveedoresFiltrados.length})
            </h3>

            {loading ? (
              <p className="text-xs text-slate-400">Cargando proveedores...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {proveedoresFiltrados.map((pr) => (
                  <div
                    key={pr.codProveedor}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-slate-900 text-sm">
                          {pr.nombreProveedor}
                        </div>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-200/70 text-slate-600">
                          ID #{pr.codProveedor}
                        </span>
                      </div>

                      <div className="text-slate-600 flex items-center gap-1.5 font-mono text-[11px]">
                        <Phone className="w-3.5 h-3.5 text-emerald-600" /> {pr.numeroProveedor}
                      </div>

                      {pr.correoProveedor && (
                        <div className="text-slate-500 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" /> {pr.correoProveedor}
                        </div>
                      )}

                      {pr.webProveedor && (
                        <a
                          href={pr.webProveedor}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:underline flex items-center gap-1 text-[11px] font-medium"
                        >
                          <Globe className="w-3 h-3" /> {pr.webProveedor}{' '}
                          <ArrowUpRight className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">
                        {pr.facturas?.length || 0} facturas •{' '}
                        {pr.productosHabituales?.length || 0} prendas
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setProveedorEditando(pr)}
                          className="text-indigo-600 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDarBajaProveedor(pr.codProveedor, pr.nombreProveedor)}
                          className="text-rose-600 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Baja
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* APARTADO 2: CARGA DE FACTURAS Y DETALLE DE INGRESO                */}
      {/* ================================================================= */}
      {(vistaActiva === 'AMBOS' || vistaActiva === 'FACTURAS') && (
        <>
          {resultadoImpacto && (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-300 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ¡Factura e Ingreso de Mercadería registrados! Impacto en Catálogo:
                </div>
                <button
                  onClick={() => setResultadoImpacto(null)}
                  className="text-xs font-semibold text-emerald-800 underline cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {resultadoImpacto.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white p-3 rounded-xl border border-emerald-200 text-xs space-y-1"
                  >
                    <div className="font-bold text-slate-900">{item.nombre}</div>
                    <div className="text-slate-600">
                      Costo Unitario: ${item.costoAnterior.toLocaleString('es-AR')} →{' '}
                      <strong className="text-slate-900">
                        ${item.costoNuevo.toLocaleString('es-AR')}
                      </strong>
                    </div>
                    <div className="text-slate-600">
                      Precio Venta Sugerido: ${item.precioVentaAnterior.toLocaleString('es-AR')} →{' '}
                      <strong className="text-emerald-700">
                        ${item.precioVentaNuevo.toLocaleString('es-AR')}
                      </strong>
                    </div>
                    {item.alertaReseteada && (
                      <div className="text-[11px] font-bold text-indigo-700">
                        ✓ Stock recuperado (&gt;= 3 u.): Flag alertaStockEnviada reseteado.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <form
            onSubmit={handleRegistrarFactura}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5"
          >
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText className="w-5 h-5 text-rose-600" /> Cargar Nueva Factura de Proveedor (
              `Factura` + `DetalleIngreso`)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Proveedor Emisor
                </label>
                <select
                  value={codProveedorSel}
                  onChange={(e) => setCodProveedorSel(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium"
                >
                  {proveedores.map((p) => (
                    <option key={p.codProveedor} value={p.codProveedor}>
                      {p.nombreProveedor} ({p.numeroProveedor})
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nro. Factura
                </label>
                <input
                  type="text"
                  required
                  value={nroFactura}
                  onChange={(e) => setNroFactura(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">IVA (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={ivaFactura}
                  onChange={(e) => setIvaFactura(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              {/* Comprobante de Factura (PDF o Foto) */}
              <div className="lg:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Comprobante (PDF o Foto)
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 py-2 px-3 rounded-xl border border-dashed border-rose-300 bg-rose-50/50 text-xs font-bold text-rose-700 hover:bg-rose-100/60 cursor-pointer flex items-center justify-center gap-1.5 truncate">
                    <Upload className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {procesandoComprobante
                        ? 'Procesando...'
                        : nombreArchivoComprobante
                        ? nombreArchivoComprobante
                        : 'Subir PDF o Foto'}
                    </span>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(e) => handleSubirComprobanteFactura(e.target.files?.[0])}
                      className="hidden"
                    />
                  </label>
                  {comprobanteUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setComprobanteUrl('');
                        setNombreArchivoComprobante('');
                      }}
                      title="Quitar comprobante adjunto"
                      className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Líneas de DetalleIngreso con Selector Interactivo estilo Carrito en Vivo */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Ítems de Mercadería Ingresada (`DetalleIngreso`)
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Seleccioná variantes existentes desde el catálogo interactivo o creá una prenda
                    nueva al instante.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      abrirModalSelectorProductos();
                      setModalNuevaPrendaAbierto(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold hover:bg-rose-100 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Nueva Prenda
                  </button>

                  <button
                    type="button"
                    onClick={abrirModalSelectorProductos}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-rose-600 transition cursor-pointer shadow-xs"
                  >
                    <PackagePlus className="w-4 h-4" /> Selección Múltiple de Indumentaria (Carrito
                    en Vivo)
                  </button>
                </div>
              </div>

              {lineasIngreso.length === 0 ? (
                <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
                  <ShoppingCart className="w-9 h-9 text-slate-300 mx-auto" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      No hay variantes seleccionadas en la factura
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Abrí el selector interactivo con carrito en vivo para elegir prendas o dar de
                      alta una nueva.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={abrirModalSelectorProductos}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Seleccionar Variantes de Prenda
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {lineasIngreso.map((linea, idx) => {
                    const infoItem = construirItemCarritoDesdeVariante(
                      linea.codVariante,
                      linea.cantidadDI,
                      linea.precioIndividual
                    );

                    return (
                      <div
                        key={`${linea.codVariante}-${idx}`}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
                      >
                        <div className="sm:col-span-6">
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                            Variante de Prenda (Talle / Color)
                          </label>
                          <button
                            type="button"
                            onClick={abrirModalSelectorProductos}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white hover:border-rose-400 transition flex items-center justify-between gap-2 text-left cursor-pointer shadow-2xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {infoItem?.imagen ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={infoItem.imagen}
                                  alt={infoItem.nombreProducto}
                                  className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                                />
                              ) : null}
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 truncate">
                                  {infoItem?.nombreProducto || `Variante #${linea.codVariante}`}
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full border border-slate-300 inline-block shrink-0"
                                    style={{ backgroundColor: infoItem?.codigoHex || '#111827' }}
                                  />
                                  <span>
                                    Talle <strong>{infoItem?.talle || '-'}</strong> •{' '}
                                    {infoItem?.color || '-'}
                                  </span>
                                  {infoItem && (
                                    <span className="text-slate-400">
                                      (Stock actual: {infoItem.stockActual} u.)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 text-rose-700 font-bold text-[11px] shrink-0">
                              Cambiar <ChevronDown className="w-3.5 h-3.5" />
                            </span>
                          </button>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                            Cantidad (`cantidadDI`)
                          </label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={linea.cantidadDI}
                            onChange={(e) => {
                              const copia = [...lineasIngreso];
                              copia[idx] = { ...linea, cantidadDI: Number(e.target.value) };
                              setLineasIngreso(copia);
                            }}
                            className="w-full px-2.5 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-white"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                            Costo Unit. (`precioIndividual`)
                          </label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={linea.precioIndividual}
                            onChange={(e) => {
                              const copia = [...lineasIngreso];
                              copia[idx] = { ...linea, precioIndividual: Number(e.target.value) };
                              setLineasIngreso(copia);
                            }}
                            className="w-full px-2.5 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-white"
                          />
                        </div>

                        <div className="sm:col-span-1 flex justify-end pt-4">
                          <button
                            type="button"
                            disabled={lineasIngreso.length <= 1}
                            onClick={() =>
                              setLineasIngreso(lineasIngreso.filter((_, i) => i !== idx))
                            }
                            className="p-2 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-sm font-bold text-slate-800">
                Costo Total Factura:{' '}
                <span className="text-lg font-extrabold text-rose-600">
                  ${costoTotalFactura.toLocaleString('es-AR')}
                </span>
              </div>
              <button
                type="submit"
                disabled={guardandoFactura || procesandoComprobante || lineasIngreso.length === 0}
                className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition cursor-pointer disabled:opacity-50"
              >
                {guardandoFactura
                  ? 'Procesando Ingreso...'
                  : 'Registrar Factura, Sumar Stock y Actualizar Costos'}
              </button>
            </div>
          </form>

          {/* Historial de Facturas Registradas */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-slate-700" /> Historial de Facturas e Ingresos de
              Stock
            </h2>
            <div className="space-y-3">
              {facturas.map((f) => {
                // El archivo se descarga aparte, así la lista de facturas no trae los comprobantes
                const urlComp = f.tieneComprobante
                  ? `/api/proveedores/comprobante/${f.idFactura}`
                  : null;
                return (
                  <div
                    key={f.idFactura}
                    className="p-4 rounded-xl border border-slate-200 space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold bg-slate-900 text-white px-2.5 py-1 rounded-lg">
                          {f.nroFactura}
                        </span>
                        <span className="font-bold text-slate-800">
                          {f.proveedor.nombreProveedor}
                        </span>
                        <span className="text-slate-400">
                          • {new Date(f.fechaFactura).toLocaleDateString('es-AR')}
                        </span>
                        {urlComp && (
                          <a
                            href={urlComp}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[11px] hover:bg-indigo-100"
                          >
                            <FileText className="w-3 h-3" /> Ver comprobante{' '}
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                      <span className="font-extrabold text-sm text-slate-900">
                        Costo Total: ${f.costoTotal.toLocaleString('es-AR')} (IVA {f.ivaFactura}%)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {f.detallesIngreso.map((di) => (
                        <span
                          key={di.idDetalleIngreso}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700"
                        >
                          +{di.cantidadDI} u. de <strong>{di.variante.producto.nombre}</strong> (
                          {di.variante.talle.nombreTalle} - {di.variante.color.nombreColor}) a $
                          {di.precioIndividual.toLocaleString('es-AR')} c/u
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ================================================================================= */}
      {/* MODAL DE SELECCIÓN DE PRODUCTOS ESTILO CARRITO EN VIVO PARA FACTURAS              */}
      {/* ================================================================================= */}
      {modalProductosAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden">
            {/* Barra Superior del Modal con botón "Nueva Prenda" */}
            <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-rose-400" /> Selección Múltiple de
                  Indumentaria (Carrito en Vivo)
                </h2>
                <p className="text-xs text-slate-400">
                  Filtra por Categoría, Marca, Proveedor o nombre. También puedes crear una Nueva
                  Prenda sin salir de la factura.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalNuevaPrendaAbierto(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition cursor-pointer shadow-xs"
                >
                  <Tag className="w-3.5 h-3.5" /> + Nueva Prenda
                </button>
                <button
                  type="button"
                  onClick={() => setModalProductosAbierto(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Cuerpo dividido: Izquierda Catálogo Filtrable (68%) | Derecha Carrito en Vivo (32%) */}
            <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
              {/* Panel Izquierdo: Buscador + Filtros + Grilla de Productos */}
              <div className="flex-1 flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-slate-200">
                <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 shrink-0">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={filtroModalTexto}
                      onChange={(e) => setFiltroModalTexto(e.target.value)}
                      placeholder="Buscar por nombre o SKU..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-xl border border-slate-200"
                    />
                  </div>

                  <select
                    value={filtroModalCategoria}
                    onChange={(e) => setFiltroModalCategoria(e.target.value)}
                    className="px-3 py-2 text-xs bg-white rounded-xl border border-slate-200"
                  >
                    <option value="TODAS">Categoría: Todas</option>
                    {categoriasCat.map((c) => (
                      <option key={c.codCategoria} value={c.codCategoria}>
                        {c.nombreCategoria}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filtroModalMarca}
                    onChange={(e) => setFiltroModalMarca(e.target.value)}
                    className="px-3 py-2 text-xs bg-white rounded-xl border border-slate-200"
                  >
                    <option value="TODAS">Marca: Todas</option>
                    {marcasCat.map((m) => (
                      <option key={m.codMarca} value={m.codMarca}>
                        {m.nombreMarca}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filtroModalProveedor}
                    onChange={(e) => setFiltroModalProveedor(e.target.value)}
                    className="px-3 py-2 text-xs bg-white rounded-xl border border-slate-200"
                  >
                    <option value="TODOS">Proveedor: Todos</option>
                    {proveedores.map((pr) => (
                      <option key={pr.codProveedor} value={pr.codProveedor}>
                        {pr.nombreProveedor}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Lista de Tarjetas de Productos para elegir */}
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4 content-start">
                  {productosFiltradosModal.map((prod) => {
                    const codVarElegida =
                      varianteSeleccionadaPorProd[prod.codProducto] ??
                      prod.variantes[0]?.codVariante;
                    const varObj = prod.variantes.find((v) => v.codVariante === codVarElegida);
                    const cantElegida = cantidadSeleccionadaPorProd[prod.codProducto] || 6;
                    const imgMostrar = varObj?.imagenVariante || prod.imagen;

                    return (
                      <div
                        key={prod.codProducto}
                        className="bg-white rounded-xl border border-slate-200 p-3.5 flex gap-3.5 shadow-2xs hover:border-rose-300 transition"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imgMostrar}
                          alt={prod.nombre}
                          className="w-20 h-24 rounded-lg object-cover bg-slate-100 shrink-0"
                        />

                        <div className="flex-1 min-w-0 flex flex-col justify-between space-y-2">
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-bold uppercase text-rose-600">
                                {prod.categoria.nombreCategoria} • {prod.marca.nombreMarca}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-slate-900 truncate mt-0.5">
                              {prod.nombre}
                            </h4>
                            <div className="text-xs font-extrabold text-slate-700 mt-0.5">
                              Costo actual:{' '}
                              <span className="text-emerald-700">
                                ${prod.precioCosto.toLocaleString('es-AR')}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <select
                              value={codVarElegida || ''}
                              onChange={(e) =>
                                setVarianteSeleccionadaPorProd({
                                  ...varianteSeleccionadaPorProd,
                                  [prod.codProducto]: Number(e.target.value),
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 font-medium"
                            >
                              {prod.variantes.map((v) => (
                                <option key={v.codVariante} value={v.codVariante}>
                                  Talle {v.talle.nombreTalle} - {v.color.nombreColor} (Stock:{' '}
                                  {v.stock} u.)
                                </option>
                              ))}
                            </select>

                            <div className="flex items-center gap-2">
                              <div className="flex items-center border border-slate-200 rounded-lg bg-white">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCantidadSeleccionadaPorProd({
                                      ...cantidadSeleccionadaPorProd,
                                      [prod.codProducto]: Math.max(1, cantElegida - 1),
                                    })
                                  }
                                  className="px-2 py-1 text-slate-600 hover:bg-slate-100 cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="px-2.5 text-xs font-bold">{cantElegida}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCantidadSeleccionadaPorProd({
                                      ...cantidadSeleccionadaPorProd,
                                      [prod.codProducto]: cantElegida + 1,
                                    })
                                  }
                                  className="px-2 py-1 text-slate-600 hover:bg-slate-100 cursor-pointer"
                                >
                                  +
                                </button>
                              </div>

                              <button
                                type="button"
                                disabled={!varObj}
                                onClick={() => agregarAlCarritoFacturaEnVivo(prod)}
                                className="flex-1 py-1.5 px-3 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition cursor-pointer disabled:opacity-40"
                              >
                                + Sumar a Factura
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Panel Lateral Derecho: Carrito en Vivo dentro del mismo Modal */}
              <div className="w-full lg:w-96 bg-slate-50 flex flex-col shrink-0 h-72 lg:h-auto">
                <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-rose-600" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                      Variantes en Factura ({carritoModalEnVivo.length})
                    </h3>
                  </div>
                  {carritoModalEnVivo.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCarritoModalEnVivo([])}
                      className="text-[11px] text-rose-600 font-semibold hover:underline cursor-pointer"
                    >
                      Vaciar
                    </button>
                  )}
                </div>

                {/* Lista de ítems en el Carrito Lateral */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                  {carritoModalEnVivo.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                      <ShoppingCart className="w-8 h-8 mb-2 stroke-1" />
                      <p className="text-xs font-medium">
                        Haz clic en &ldquo;+ Sumar a Factura&rdquo; en cualquier prenda de la
                        izquierda o crea una &ldquo;Nueva Prenda&rdquo; y se agregará aquí en vivo.
                      </p>
                    </div>
                  ) : (
                    carritoModalEnVivo.map((item) => (
                      <div
                        key={item.codVariante}
                        className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              {item.nombreProducto}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-slate-300 inline-block"
                                style={{ backgroundColor: item.codigoHex }}
                              />
                              <span>
                                Talle <strong>{item.talle}</strong> • {item.color}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setCarritoModalEnVivo((prev) =>
                                prev.filter((x) => x.codVariante !== item.codVariante)
                              )
                            }
                            className="text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => cambiarCantidadEnCarritoModal(item.codVariante, -1)}
                              className="p-1 rounded bg-slate-100 hover:bg-slate-200 cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-bold px-1.5">{item.cantidadDI} u.</span>
                            <button
                              type="button"
                              onClick={() => cambiarCantidadEnCarritoModal(item.codVariante, 1)}
                              className="p-1 rounded bg-slate-100 hover:bg-slate-200 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 font-semibold">Costo:</span>
                            <input
                              type="number"
                              min={1}
                              value={item.precioIndividual}
                              onChange={(e) =>
                                cambiarCostoEnCarritoModal(
                                  item.codVariante,
                                  Number(e.target.value)
                                )
                              }
                              className="w-20 px-2 py-1 text-xs font-bold text-right rounded border border-slate-200"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Pie del Panel Lateral con Subtotal en Vivo y Botón Confirmar Selección */}
                <div className="p-4 bg-white border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">
                      Costo Total Seleccionado:
                    </span>
                    <span className="text-lg font-extrabold text-emerald-700">
                      ${totalCarritoModalEnVivo.toLocaleString('es-AR')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={confirmarSeleccionModal}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition cursor-pointer shadow-xs"
                  >
                    Confirmar Selección ({carritoModalEnVivo.reduce((a, b) => a + b.cantidadDI, 0)}{' '}
                    unidades)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================================= */}
      {/* MODAL SUPERPUESTO DE NUEVA PRENDA (SIN CERRAR EL FLUJO DE FACTURA NI EL SELECTOR) */}
      {/* ================================================================================= */}
      <NuevaPrendaModal
        abierto={modalNuevaPrendaAbierto}
        onClose={() => setModalNuevaPrendaAbierto(false)}
        marcasIniciales={marcasCat}
        categorias={categoriasCat}
        temporadas={temporadasCat}
        descuentosIniciales={descuentosCat}
        proveedoresIniciales={proveedores}
        talles={tallesCat}
        coloresIniciales={coloresCat}
        codProveedorPreseleccionado={codProveedorSel}
        zIndexClass="z-[60]"
        onSuccess={handleNuevaPrendaCreadaParaFactura}
        modoIngresoFactura
      />
    </div>
  );
}
