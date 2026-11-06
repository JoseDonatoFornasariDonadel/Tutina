'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  UserPlus,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  MessageSquareWarning,
  X,
  UserCheck,
  Calendar,
  Hash,
  CreditCard,
  Filter,
  ArrowRight,
  PackagePlus,
} from 'lucide-react';
import {
  calcularPrecioNetoConDescuento,
  obtenerPorcentajeDescuentoVigente,
} from '@/lib/services/pricing.service';
import { useAppConfig } from '@/components/layout/AppShell';

interface Cliente {
  codCliente: number;
  nombreCliente: string;
  apellidoCliente: string;
  telefonoCliente: string;
  emailCliente?: string | null;
  dniCuit?: string | null;
}

interface VarianteCat {
  codVariante: number;
  sku: string;
  stock: number;
  talle: { codTalle: number; nombreTalle: string };
  color: { codColor: number; nombreColor: string; codigoHex: string };
}

interface ProductoCat {
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
  categoria: { codCategoria: number; nombreCategoria: string };
  proveedorHabitual?: { codProveedor: number; nombreProveedor: string } | null;
  descuento?: {
    codDescuento: number;
    nombreDesc: string;
    porcentajeDesc: number;
    fechaInicioDesc: string;
    fechaFinDesc: string;
  } | null;
  variantes: VarianteCat[];
}

interface ItemCarrito {
  codVariante: number;
  codProducto: number;
  sku: string;
  nombreProducto: string;
  imagen: string;
  marca: string;
  talle: string;
  color: string;
  codigoHex: string;
  stockDisponible: number;
  cantidad: number;
  precioUnitarioLista: number;
  porcentajeDescuento: number;
  precioUnitarioVentaNeto: number;
}

export default function NuevoPedidoPage() {
  const { refreshGlobalState } = useAppConfig();

  // Datos Maestros
  const [proximoNroPedido, setProximoNroPedido] = useState<number>(1);
  const [fechaPedido, setFechaPedido] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<ProductoCat[]>([]);
  const [categorias, setCategorias] = useState<{ codCategoria: number; nombreCategoria: string }[]>(
    []
  );
  const [marcas, setMarcas] = useState<{ codMarca: number; nombreMarca: string }[]>([]);
  const [proveedores, setProveedores] = useState<
    { codProveedor: number; nombreProveedor: string }[]
  >([]);
  const [formasPago, setFormasPago] = useState<
    { codFP: number; nombreFP: string; porcentajeComisionActual: number }[]
  >([]);
  const [estadosPedido, setEstadosPedido] = useState<{ codEP: number; nombreEP: string }[]>([]);

  // Selección en Formulario Principal de Pedido
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [mostrarDropdownClientes, setMostrarDropdownClientes] = useState(false);

  // Alta Rápida ("Al Vuelo") de Cliente
  const [mostrarAltaClienteAlVuelo, setMostrarAltaClienteAlVuelo] = useState(false);
  const [nuevoClienteForm, setNuevoClienteForm] = useState({
    nombreCliente: '',
    apellidoCliente: '',
    telefonoCliente: '+549351',
    dniCuit: '',
  });
  const [creandoCliente, setCreandoCliente] = useState(false);

  // Forma de Pago y Observaciones
  const [codFPSeleccionado, setCodFPSeleccionado] = useState<number>(1);
  const [codEstadoSeleccionado, setCodEstadoSeleccionado] = useState<number>(1);
  const [observaciones, setObservaciones] = useState('');

  // Carrito Confirmado en el Pedido Principal
  const [itemsPedido, setItemsPedido] = useState<ItemCarrito[]>([]);

  // Modal de Selección de Productos (Estilo Carrito Persistente)
  const [modalProductosAbierto, setModalProductosAbierto] = useState(false);
  const [carritoModalEnVivo, setCarritoModalEnVivo] = useState<ItemCarrito[]>([]);
  const [filtroModalTexto, setFiltroModalTexto] = useState('');
  const [filtroModalCategoria, setFiltroModalCategoria] = useState('TODAS');
  const [filtroModalMarca, setFiltroModalMarca] = useState('TODAS');
  const [filtroModalProveedor, setFiltroModalProveedor] = useState('TODOS');

  // Selección temporal de variante y cantidad en cada tarjeta del modal
  const [varianteSeleccionadaPorProd, setVarianteSeleccionadaPorProd] = useState<
    Record<number, number>
  >({});
  const [cantidadSeleccionadaPorProd, setCantidadSeleccionadaPorProd] = useState<
    Record<number, number>
  >({});

  // Estado de guardado y resultado de WhatsApp
  const [registrandoPedido, setRegistrandoPedido] = useState(false);
  const [resultadoExito, setResultadoExito] = useState<{
    nroPedido: number;
    total: number;
    cliente: string;
    alertasWhatsApp: {
      sku: string;
      nombreProducto: string;
      stockRemanente: number;
      mensaje: string;
      telefonoDestino: string;
    }[];
  } | null>(null);

  const cargarDatosIniciales = async () => {
    const [pedRes, cliRes, catRes] = await Promise.all([
      fetch('/api/pedidos', { cache: 'no-store' }),
      fetch('/api/clientes', { cache: 'no-store' }),
      fetch('/api/catalogo?all=true', { cache: 'no-store' }),
    ]);
    const pedData = await pedRes.json();
    const cliData = await cliRes.json();
    const catData = await catRes.json();

    setProximoNroPedido(pedData.proximoNroPedido || 1);
    setFormasPago(pedData.formasPago || []);
    setEstadosPedido(pedData.estados || []);
    if (pedData.formasPago?.[0]) setCodFPSeleccionado(pedData.formasPago[0].codFP);
    if (pedData.estados?.[0]) setCodEstadoSeleccionado(pedData.estados[0].codEP);

    setClientes(cliData || []);
    const prods: ProductoCat[] = catData.productos || [];
    setProductos(prods);
    setCategorias(catData.categorias || []);
    setMarcas(catData.marcas || []);
    setProveedores(catData.proveedores || []);

    // Preseleccionar la primera variante con stock disponible por cada producto
    const mapVar: Record<number, number> = {};
    const mapCant: Record<number, number> = {};
    for (const p of prods) {
      const varConStock = p.variantes.find((v) => v.stock > 0) || p.variantes[0];
      if (varConStock) {
        mapVar[p.codProducto] = varConStock.codVariante;
      }
      mapCant[p.codProducto] = 1;
    }
    setVarianteSeleccionadaPorProd(mapVar);
    setCantidadSeleccionadaPorProd(mapCant);
  };

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  // Filtrado de Clientes en el buscador
  const clientesFiltrados = useMemo(() => {
    const q = busquedaCliente.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        `${c.nombreCliente} ${c.apellidoCliente}`.toLowerCase().includes(q) ||
        `${c.apellidoCliente} ${c.nombreCliente}`.toLowerCase().includes(q) ||
        c.telefonoCliente.toLowerCase().includes(q) ||
        (c.dniCuit && c.dniCuit.toLowerCase().includes(q))
    );
  }, [clientes, busquedaCliente]);

  // Handler de Alta Rápida de Cliente ("Al Vuelo") sin perder el pedido actual
  const handleCrearClienteAlVuelo = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreandoCliente(true);
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoClienteForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear cliente');

      // Agregar a la lista local y seleccionarlo automáticamente en este pedido
      setClientes((prev) => [...prev, data]);
      setClienteSeleccionado(data);
      setBusquedaCliente(`${data.apellidoCliente}, ${data.nombreCliente}`);
      setMostrarAltaClienteAlVuelo(false);
      setMostrarDropdownClientes(false);
      setNuevoClienteForm({
        nombreCliente: '',
        apellidoCliente: '',
        telefonoCliente: '+549351',
        dniCuit: '',
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'No se pudo crear el cliente');
    } finally {
      setCreandoCliente(false);
    }
  };

  // Abrir Modal de Selección de Productos sincronizando con lo ya cargado en el pedido
  const abrirModalProductos = () => {
    setCarritoModalEnVivo([...itemsPedido]);
    setModalProductosAbierto(true);
  };

  // Productos filtrados dentro del Modal (Categoría, Marca, Proveedor y Nombre)
  const productosFiltradosModal = useMemo(() => {
    return productos.filter((p) => {
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
    productos,
    filtroModalTexto,
    filtroModalCategoria,
    filtroModalMarca,
    filtroModalProveedor,
  ]);

  // Agregar prenda al Carrito Lateral en Vivo (SIN CERRAR EL MODAL)
  const agregarAlCarritoEnVivo = (prod: ProductoCat) => {
    const codVarianteElegida = varianteSeleccionadaPorProd[prod.codProducto];
    const variante = prod.variantes.find((v) => v.codVariante === codVarianteElegida);
    if (!variante) return;

    const cantSolicitada = cantidadSeleccionadaPorProd[prod.codProducto] || 1;
    const pctDesc = obtenerPorcentajeDescuentoVigente(prod.descuento);
    const precioNeto = calcularPrecioNetoConDescuento(prod.precio, pctDesc);

    setCarritoModalEnVivo((prev) => {
      const existenteIdx = prev.findIndex((item) => item.codVariante === variante.codVariante);
      if (existenteIdx >= 0) {
        const copia = [...prev];
        const nuevaCant = Math.min(
          variante.stock,
          copia[existenteIdx].cantidad + cantSolicitada
        );
        copia[existenteIdx] = {
          ...copia[existenteIdx],
          cantidad: nuevaCant,
        };
        return copia;
      }

      if (variante.stock < 1) {
        alert('Esta variante no posee stock disponible.');
        return prev;
      }

      return [
        ...prev,
        {
          codVariante: variante.codVariante,
          codProducto: prod.codProducto,
          sku: variante.sku,
          nombreProducto: prod.nombre,
          imagen: prod.imagen,
          marca: prod.marca.nombreMarca,
          talle: variante.talle.nombreTalle,
          color: variante.color.nombreColor,
          codigoHex: variante.color.codigoHex,
          stockDisponible: variante.stock,
          cantidad: Math.min(variante.stock, cantSolicitada),
          precioUnitarioLista: prod.precio,
          porcentajeDescuento: pctDesc,
          precioUnitarioVentaNeto: precioNeto,
        },
      ];
    });
  };

  const cambiarCantidadEnCarritoModal = (codVariante: number, delta: number) => {
    setCarritoModalEnVivo((prev) =>
      prev
        .map((it) => {
          if (it.codVariante !== codVariante) return it;
          const nueva = it.cantidad + delta;
          if (nueva <= 0) return null;
          return {
            ...it,
            cantidad: Math.min(it.stockDisponible, nueva),
          };
        })
        .filter(Boolean) as ItemCarrito[]
    );
  };

  const confirmarSeleccionModal = () => {
    setItemsPedido([...carritoModalEnVivo]);
    setModalProductosAbierto(false);
  };

  // Totales del Pedido (siempre sobre precio de venta neto, nunca precioCosto)
  const subtotalBrutoPedido = useMemo(
    () => itemsPedido.reduce((acc, it) => acc + it.precioUnitarioLista * it.cantidad, 0),
    [itemsPedido]
  );

  const totalVentaPedido = useMemo(
    () => itemsPedido.reduce((acc, it) => acc + it.precioUnitarioVentaNeto * it.cantidad, 0),
    [itemsPedido]
  );

  const totalCarritoModalEnVivo = useMemo(
    () => carritoModalEnVivo.reduce((acc, it) => acc + it.precioUnitarioVentaNeto * it.cantidad, 0),
    [carritoModalEnVivo]
  );

  // Confirmar y Registrar Pedido en Base de Datos
  const handleConfirmarPedidoFinal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteSeleccionado) {
      alert('Por favor selecciona o crea un Cliente antes de registrar el pedido.');
      return;
    }
    if (itemsPedido.length === 0) {
      alert('Agrega al menos una prenda desde el Modal de Selección de Productos.');
      return;
    }

    setRegistrandoPedido(true);
    try {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fechaPedido,
          codCliente: clienteSeleccionado.codCliente,
          codEstadoActual: codEstadoSeleccionado,
          codFP: codFPSeleccionado,
          canalVenta: 'LOCAL_MANUAL',
          observaciones,
          items: itemsPedido.map((it) => ({
            codVariante: it.codVariante,
            cantidad: it.cantidad,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar el pedido');

      setResultadoExito({
        nroPedido: data.pedido.nroPedido,
        total: data.pedido.total,
        cliente: `${clienteSeleccionado.nombreCliente} ${clienteSeleccionado.apellidoCliente}`,
        alertasWhatsApp: data.alertasWhatsAppDisparadas || [],
      });

      setItemsPedido([]);
      setClienteSeleccionado(null);
      setBusquedaCliente('');
      setObservaciones('');
      await cargarDatosIniciales();
      await refreshGlobalState();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al registrar pedido');
    } finally {
      setRegistrandoPedido(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Ventas & Mostrador Tutina
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Registro Manual de Pedido</h1>
          <p className="text-sm text-slate-500">
            Adjudica el pedido a un cliente (o créalo al vuelo), selecciona las prendas desde el
            carrito interactivo y confirma la operación.
          </p>
        </div>
        <Link
          href="/pedidos"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Ver Historial de Pedidos <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Banner de Confirmación de Pedido + Alerta WhatsApp Disparada si stock < 3 */}
      {resultadoExito && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-5 space-y-4 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-emerald-950">
                  ¡Pedido #{String(resultadoExito.nroPedido).padStart(4, '0')} registrado con éxito!
                </h3>
                <p className="text-xs text-emerald-800">
                  Cliente: <strong>{resultadoExito.cliente}</strong> • Total cobrado (Precio Venta):{' '}
                  <strong>${resultadoExito.total.toLocaleString('es-AR')}</strong>
                </p>
              </div>
            </div>
            <button
              onClick={() => setResultadoExito(null)}
              className="text-xs font-semibold text-emerald-800 underline cursor-pointer"
            >
              Cerrar aviso
            </button>
          </div>

          {resultadoExito.alertasWhatsApp.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-300 p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                <MessageSquareWarning className="w-4 h-4 text-amber-600" />
                Alerta Automática de WhatsApp Disparada a la Dueña (Stock &lt; 3 unidades)
              </div>
              {resultadoExito.alertasWhatsApp.map((al, i) => (
                <div
                  key={i}
                  className="bg-white p-3 rounded-lg border border-amber-200 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-mono text-[11px] text-emerald-700 font-semibold">
                      Enviado a WhatsApp: {al.telefonoDestino}
                    </p>
                    <p className="mt-0.5 text-slate-800">{al.mensaje}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-[11px] shrink-0">
                    Quedan {al.stockRemanente} u.
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Formulario Principal del Pedido */}
      <form onSubmit={handleConfirmarPedidoFinal} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda (2/3): Datos del Pedido, Buscador/Alta de Cliente y Lista de Productos */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bloque 1: nroPedido, fechaPedido y Cliente con Alta Al Vuelo */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              1. Datos de Cabecera y Adjudicación de Cliente
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* nroPedido Autogenerado */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-rose-500" /> Nro. de Pedido (Autogenerado)
                </label>
                <input
                  type="text"
                  readOnly
                  value={`#${String(proximoNroPedido).padStart(4, '0')}`}
                  className="w-full px-3.5 py-2.5 text-sm font-mono font-bold bg-slate-100 text-slate-700 rounded-xl border border-slate-200 cursor-not-allowed"
                />
              </div>

              {/* fechaPedido */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-rose-500" /> Fecha del Pedido
                </label>
                <input
                  type="date"
                  required
                  value={fechaPedido}
                  onChange={(e) => setFechaPedido(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            {/* Selector / Buscador de Cliente con Alta Rápida "Al Vuelo" */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  Cliente Adjudicado al Pedido *
                </label>
                <button
                  type="button"
                  onClick={() => setMostrarAltaClienteAlVuelo(!mostrarAltaClienteAlVuelo)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {mostrarAltaClienteAlVuelo
                    ? 'Cerrar alta rápida'
                    : '+ Crear nuevo cliente al vuelo'}
                </button>
              </div>

              {/* Buscador interactivo de Clientes */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={busquedaCliente}
                  onFocus={() => setMostrarDropdownClientes(true)}
                  onChange={(e) => {
                    setBusquedaCliente(e.target.value);
                    setClienteSeleccionado(null);
                    setMostrarDropdownClientes(true);
                  }}
                  placeholder="Buscar cliente por nombre, apellido, teléfono o DNI..."
                  className="w-full pl-10 pr-24 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                {clienteSeleccionado && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                    <UserCheck className="w-3.5 h-3.5" /> Seleccionado
                  </span>
                )}

                {/* Lista desplegable de resultados de búsqueda */}
                {mostrarDropdownClientes && !clienteSeleccionado && (
                  <div className="absolute z-20 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {clientesFiltrados.length > 0 ? (
                      clientesFiltrados.map((c) => (
                        <button
                          type="button"
                          key={c.codCliente}
                          onClick={() => {
                            setClienteSeleccionado(c);
                            setBusquedaCliente(
                              `${c.apellidoCliente}, ${c.nombreCliente} (${c.telefonoCliente})`
                            );
                            setMostrarDropdownClientes(false);
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-rose-50/60 flex items-center justify-between text-xs cursor-pointer"
                        >
                          <div>
                            <span className="font-bold text-slate-900">
                              {c.apellidoCliente}, {c.nombreCliente}
                            </span>
                            {c.dniCuit && (
                              <span className="ml-2 text-slate-400">DNI: {c.dniCuit}</span>
                            )}
                          </div>
                          <span className="font-mono text-slate-600">{c.telefonoCliente}</span>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center space-y-2">
                        <p className="text-xs text-slate-500">
                          No existe ningún cliente que coincida con &ldquo;{busquedaCliente}&rdquo;.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            const partes = busquedaCliente.trim().split(' ');
                            setNuevoClienteForm({
                              ...nuevoClienteForm,
                              nombreCliente: partes[0] || '',
                              apellidoCliente: partes.slice(1).join(' ') || '',
                            });
                            setMostrarAltaClienteAlVuelo(true);
                            setMostrarDropdownClientes(false);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Crear cliente &ldquo;
                          {busquedaCliente}&rdquo; en este instante
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Mini-Formulario Inline de "Alta al Vuelo" de Cliente */}
              {mostrarAltaClienteAlVuelo && (
                <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-rose-600" /> Alta Rápida de Cliente al Vuelo
                      (No perderás los productos del pedido actual)
                    </span>
                    <button
                      type="button"
                      onClick={() => setMostrarAltaClienteAlVuelo(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Nombre *"
                      value={nuevoClienteForm.nombreCliente}
                      onChange={(e) =>
                        setNuevoClienteForm({ ...nuevoClienteForm, nombreCliente: e.target.value })
                      }
                      className="px-3 py-2 text-xs bg-white rounded-lg border border-slate-300"
                    />
                    <input
                      type="text"
                      placeholder="Apellido *"
                      value={nuevoClienteForm.apellidoCliente}
                      onChange={(e) =>
                        setNuevoClienteForm({
                          ...nuevoClienteForm,
                          apellidoCliente: e.target.value,
                        })
                      }
                      className="px-3 py-2 text-xs bg-white rounded-lg border border-slate-300"
                    />
                    <input
                      type="text"
                      placeholder="Teléfono WhatsApp *"
                      value={nuevoClienteForm.telefonoCliente}
                      onChange={(e) =>
                        setNuevoClienteForm({
                          ...nuevoClienteForm,
                          telefonoCliente: e.target.value,
                        })
                      }
                      className="px-3 py-2 text-xs bg-white rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={creandoCliente}
                      onClick={handleCrearClienteAlVuelo}
                      className="px-4 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer"
                    >
                      {creandoCliente ? 'Guardando...' : 'Guardar y Adjudicar al Pedido'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bloque 2: Productos del Pedido */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  2. Indumentaria Seleccionada en el Pedido
                </h2>
                <p className="text-xs text-slate-500">
                  Los subtotales se calculan sobre el Precio de Venta vigente al público.
                </p>
              </div>
              <button
                type="button"
                onClick={abrirModalProductos}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-rose-600 transition cursor-pointer shadow-xs"
              >
                <PackagePlus className="w-4 h-4" /> Abrir Catálogo / Modal de Productos
              </button>
            </div>

            {itemsPedido.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
                <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto" />
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Aún no has agregado prendas a este pedido
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Usa el botón superior para abrir la ventana de selección múltiple con carrito en
                    vivo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={abrirModalProductos}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold hover:bg-rose-100 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Seleccionar Productos
                </button>
              </div>
            ) : (
              <>
              {/* Móvil: lista compacta del carrito */}
              <ul className="sm:hidden divide-y divide-slate-100 -mx-1">
                {itemsPedido.map((item) => (
                  <li key={item.codVariante} className="py-3 px-1 flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 truncate">{item.nombreProducto}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Talle {item.talle} • {item.color}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        {item.cantidad} × ${item.precioUnitarioLista.toLocaleString('es-AR')}
                        {item.porcentajeDescuento > 0 && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 font-bold">
                            -{item.porcentajeDescuento}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-extrabold text-slate-900">
                        ${(item.precioUnitarioVentaNeto * item.cantidad).toLocaleString('es-AR')}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setItemsPedido((prev) =>
                            prev.filter((x) => x.codVariante !== item.codVariante)
                          )
                        }
                        aria-label={`Quitar ${item.nombreProducto}`}
                        className="touch-target -mr-2 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">Prenda / Variante</th>
                      <th className="py-3 px-3 text-center">Cant.</th>
                      <th className="py-3 px-3 text-right">Precio Venta Unit.</th>
                      <th className="py-3 px-3 text-right">Dto.</th>
                      <th className="py-3 px-3 text-right">Subtotal</th>
                      <th className="py-3 px-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemsPedido.map((item) => (
                      <tr key={item.codVariante}>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{item.nombreProducto}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="font-mono">{item.sku}</span> •
                            <span>Talle {item.talle}</span> •<span>{item.color}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-900">
                          {item.cantidad}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-slate-700">
                          ${item.precioUnitarioLista.toLocaleString('es-AR')}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {item.porcentajeDescuento > 0 ? (
                            <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-bold">
                              -{item.porcentajeDescuento}%
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-extrabold text-slate-900">
                          ${(item.precioUnitarioVentaNeto * item.cantidad).toLocaleString('es-AR')}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setItemsPedido((prev) =>
                                prev.filter((x) => x.codVariante !== item.codVariante)
                              )
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </div>

        {/* Columna Derecha (1/3): Forma de Pago, Resumen y Total (sobre Precio de Venta) */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5 sticky top-6">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              3. Pago, Estado y Confirmación
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-rose-500" /> Forma de Pago
              </label>
              <select
                value={codFPSeleccionado}
                onChange={(e) => setCodFPSeleccionado(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white"
              >
                {formasPago.map((fp) => (
                  <option key={fp.codFP} value={fp.codFP}>
                    {fp.nombreFP}{' '}
                    {fp.porcentajeComisionActual > 0
                      ? `(Comisión pasarela: ${fp.porcentajeComisionActual}%)`
                      : '(Sin comisión)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Estado Inicial del Pedido
              </label>
              <select
                value={codEstadoSeleccionado}
                onChange={(e) => setCodEstadoSeleccionado(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white"
              >
                {estadosPedido.map((ep) => (
                  <option key={ep.codEP} value={ep.codEP}>
                    {ep.nombreEP}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Observaciones / Notas de Entrega
              </label>
              <textarea
                rows={2}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Ej: Retira por showroom el viernes..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
              />
            </div>

            {/* Resumen de Totales */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2.5">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Subtotal Precio Lista:</span>
                <span>${subtotalBrutoPedido.toLocaleString('es-AR')}</span>
              </div>
              {subtotalBrutoPedido > totalVentaPedido && (
                <div className="flex justify-between text-xs text-rose-400 font-semibold">
                  <span>Descuentos Promocionales:</span>
                  <span>
                    -${(subtotalBrutoPedido - totalVentaPedido).toLocaleString('es-AR')}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-800 flex items-baseline justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Total a Cobrar:
                </span>
                <span className="text-2xl font-extrabold text-emerald-400">
                  ${totalVentaPedido.toLocaleString('es-AR')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Calculado íntegramente sobre el precio de venta vigente al cliente.
              </p>
            </div>

            <button
              type="submit"
              disabled={registrandoPedido || itemsPedido.length === 0 || !clienteSeleccionado}
              className="w-full py-3 px-4 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 transition cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {registrandoPedido
                ? 'Procesando Pedido y Stock...'
                : 'Confirmar y Registrar Pedido'}
            </button>
          </div>
        </div>
      </form>

      {/* ================================================================================= */}
      {/* MODAL DE SELECCIÓN DE PRODUCTOS ESTILO CARRITO EN VIVO (NO SE CIERRA AL ELEGIR)   */}
      {/* ================================================================================= */}
      {modalProductosAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-stretch sm:items-center justify-center sm:p-6">
          <div className="bg-white sm:rounded-2xl w-full max-w-6xl h-dvh sm:h-[90vh] flex flex-col sm:border border-slate-200 shadow-2xl overflow-hidden">
            {/* Barra Superior del Modal */}
            <div className="px-4 sm:px-6 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] sm:py-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-rose-400 shrink-0" />
                  <span className="sm:hidden">Elegir prendas</span>
                  <span className="hidden sm:inline">
                    Selección Múltiple de Indumentaria (Carrito en Vivo)
                  </span>
                </h2>
                <p className="hidden sm:block text-xs text-slate-400">
                  Filtra por Categoría, Marca, Proveedor o nombre. Puedes seguir eligiendo varias
                  prendas sin que se cierre la ventana.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalProductosAbierto(false)}
                aria-label="Cerrar"
                className="touch-target -mr-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo dividido: Izquierda Catálogo Filtrable (68%) | Derecha Carrito en Vivo (32%) */}
            <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
              {/* Panel Izquierdo: Buscador + Filtros + Grilla de Productos */}
              <div className="flex-1 flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-slate-200">
                {/* Controles de Filtro por Categoría, Marca, Proveedor y Buscador */}
                <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-3 sm:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-2.5 shrink-0">
                  <div className="relative col-span-3 sm:col-span-1">
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
                    className="min-w-0 px-2 sm:px-3 py-2 text-xs bg-white rounded-xl border border-slate-200"
                  >
                    <option value="TODAS">Categoría: Todas</option>
                    {categorias.map((c) => (
                      <option key={c.codCategoria} value={c.codCategoria}>
                        {c.nombreCategoria}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filtroModalMarca}
                    onChange={(e) => setFiltroModalMarca(e.target.value)}
                    className="min-w-0 px-2 sm:px-3 py-2 text-xs bg-white rounded-xl border border-slate-200"
                  >
                    <option value="TODAS">Marca: Todas</option>
                    {marcas.map((m) => (
                      <option key={m.codMarca} value={m.codMarca}>
                        {m.nombreMarca}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filtroModalProveedor}
                    onChange={(e) => setFiltroModalProveedor(e.target.value)}
                    className="min-w-0 px-2 sm:px-3 py-2 text-xs bg-white rounded-xl border border-slate-200"
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
                    const pctDesc = obtenerPorcentajeDescuentoVigente(prod.descuento);
                    const precioNeto = calcularPrecioNetoConDescuento(prod.precio, pctDesc);
                    const codVarElegida = varianteSeleccionadaPorProd[prod.codProducto];
                    const varObj = prod.variantes.find((v) => v.codVariante === codVarElegida);
                    const cantElegida = cantidadSeleccionadaPorProd[prod.codProducto] || 1;

                    return (
                      <div
                        key={prod.codProducto}
                        className="bg-white rounded-xl border border-slate-200 p-3.5 flex gap-3.5 shadow-2xs hover:border-rose-300 transition"
                      >
                        {/* Miniatura */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={prod.imagen}
                          alt={prod.nombre}
                          className="w-20 h-24 rounded-lg object-cover bg-slate-100 shrink-0"
                        />

                        <div className="flex-1 min-w-0 flex flex-col justify-between space-y-2">
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-bold uppercase text-rose-600">
                                {prod.categoria.nombreCategoria} • {prod.marca.nombreMarca}
                              </span>
                              {pctDesc > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-[10px]">
                                  -{pctDesc}%
                                </span>
                              )}
                            </div>
                            <h4 className="text-xs font-bold text-slate-900 truncate mt-0.5">
                              {prod.nombre}
                            </h4>
                            <div className="text-sm font-extrabold text-emerald-700 mt-0.5">
                              ${precioNeto.toLocaleString('es-AR')}
                              {pctDesc > 0 && (
                                <span className="text-[11px] line-through text-slate-400 font-normal ml-1.5">
                                  ${prod.precio.toLocaleString('es-AR')}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Selector de Variante (Talle/Color) y Cantidad */}
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
                                <option
                                  key={v.codVariante}
                                  value={v.codVariante}
                                  disabled={v.stock <= 0}
                                >
                                  Talle {v.talle.nombreTalle} - {v.color.nombreColor} (Disp:{' '}
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
                                      [prod.codProducto]: Math.min(
                                        varObj?.stock || 1,
                                        cantElegida + 1
                                      ),
                                    })
                                  }
                                  className="px-2 py-1 text-slate-600 hover:bg-slate-100 cursor-pointer"
                                >
                                  +
                                </button>
                              </div>

                              <button
                                type="button"
                                disabled={!varObj || varObj.stock <= 0}
                                onClick={() => agregarAlCarritoEnVivo(prod)}
                                className="flex-1 min-h-11 sm:min-h-0 py-1.5 px-3 rounded-lg bg-rose-600 text-white text-sm sm:text-xs font-bold hover:bg-rose-700 transition cursor-pointer disabled:opacity-40"
                              >
                                + Sumar al Pedido
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
              <div className="w-full lg:w-96 bg-slate-50 flex flex-col shrink-0 sm:h-72 lg:h-auto">
                <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-rose-600" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                      Productos Seleccionados ({carritoModalEnVivo.length})
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
                <div className="flex-1 overflow-y-auto scroll-touch p-4 space-y-2.5 max-sm:hidden">
                  {carritoModalEnVivo.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                      <ShoppingCart className="w-8 h-8 mb-2 stroke-1" />
                      <p className="text-xs font-medium">
                        Haz clic en &ldquo;+ Sumar al Pedido&rdquo; en cualquier prenda de la
                        izquierda y se irá acumulando aquí sin cerrar la ventana.
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
                            <div className="text-[11px] text-slate-500">
                              Talle <strong>{item.talle}</strong> • {item.color}
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

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => cambiarCantidadEnCarritoModal(item.codVariante, -1)}
                              className="p-1 rounded bg-slate-100 hover:bg-slate-200 cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-bold px-1.5">{item.cantidad} u.</span>
                            <button
                              type="button"
                              onClick={() => cambiarCantidadEnCarritoModal(item.codVariante, 1)}
                              className="p-1 rounded bg-slate-100 hover:bg-slate-200 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="text-xs font-extrabold text-slate-900">
                            ${(item.precioUnitarioVentaNeto * item.cantidad).toLocaleString('es-AR')}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Pie del Panel Lateral con Subtotal en Vivo y Botón Confirmar Selección */}
                <div className="p-4 pb-safe-4 sm:pb-4 bg-white border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">Total Seleccionado:</span>
                    <span className="text-lg font-extrabold text-emerald-700">
                      ${totalCarritoModalEnVivo.toLocaleString('es-AR')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={confirmarSeleccionModal}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition cursor-pointer shadow-xs"
                  >
                    Confirmar Selección ({carritoModalEnVivo.reduce((a, b) => a + b.cantidad, 0)}{' '}
                    prendas)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
