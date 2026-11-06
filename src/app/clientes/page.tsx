'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  UserPlus,
  Phone,
  Mail,
  ShoppingBag,
  Calendar,
  CreditCard,
  X,
  ChevronRight,
  Clock,
  Tag,
  CheckCircle2,
  Hash,
  ExternalLink,
  Banknote,
} from 'lucide-react';

interface DetalleCompraCliente {
  idDetallePedido: number;
  Cantidad: number;
  precioUnitarioVenta: number;
  porcentajeDescuentoAplicado: number;
  precioUnitarioNeto: number;
  subtotal: number;
  variante: {
    codVariante: number;
    sku: string;
    imagenVariante?: string | null;
    producto: {
      codProducto: number;
      nombre: string;
      imagen: string;
      marca: { nombreMarca: string };
      categoria: { nombreCategoria: string };
    };
    talle: { nombreTalle: string };
    color: { nombreColor: string; codigoHex: string };
  };
}

interface PedidoDeCliente {
  nroPedido: number;
  fechaPedido: string;
  canalVenta: string;
  subtotalBruto: number;
  montoDescuentosTotal: number;
  total: number;
  totalPagado: number;
  totalAPagar: number;
  observaciones?: string | null;
  estadoActual: {
    codEP: number;
    nombreEP: string;
    colorBadge: string;
    liberaStock: boolean;
  };
  formasPago: {
    montoPFP: number;
    formaPago: { nombreFP: string };
  }[];
  detallesPedido: DetalleCompraCliente[];
}

interface ClienteConHistorial {
  codCliente: number;
  nombreCliente: string;
  apellidoCliente: string;
  telefonoCliente: string;
  emailCliente?: string | null;
  dniCuit?: string | null;
  fechaAltaCliente: string;
  pedidos: PedidoDeCliente[];
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteConHistorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  // Cliente seleccionado cuya ventana de histórico de prendas por pedido está abierta
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteConHistorial | null>(null);

  // Formulario para dar de alta un nuevo cliente
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false);
  const [nuevoClienteForm, setNuevoClienteForm] = useState({
    nombreCliente: '',
    apellidoCliente: '',
    telefonoCliente: '+549351',
    emailCliente: '',
    dniCuit: '',
  });
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  const cargarClientes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clientes', { cache: 'no-store' });
      const data = await res.json();
      setClientes(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarClientes();
  }, []);

  const clientesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        `${c.nombreCliente} ${c.apellidoCliente}`.toLowerCase().includes(q) ||
        `${c.apellidoCliente} ${c.nombreCliente}`.toLowerCase().includes(q) ||
        c.telefonoCliente.toLowerCase().includes(q) ||
        (c.dniCuit && c.dniCuit.toLowerCase().includes(q)) ||
        (c.emailCliente && c.emailCliente.toLowerCase().includes(q))
    );
  }, [clientes, busqueda]);

  const handleCrearCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardandoCliente(true);
    setMensajeExito(null);
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoClienteForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar cliente');

      setMensajeExito(
        `Cliente "${data.apellidoCliente}, ${data.nombreCliente}" registrado correctamente.`
      );
      setNuevoClienteForm({
        nombreCliente: '',
        apellidoCliente: '',
        telefonoCliente: '+549351',
        emailCliente: '',
        dniCuit: '',
      });
      setMostrarNuevoCliente(false);
      await cargarClientes();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al registrar cliente');
    } finally {
      setGuardandoCliente(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-row items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Directorio de Clientes & Fidelización
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 sm:mt-1">
            <span className="sm:hidden">Clientes</span>
            <span className="hidden sm:inline">Clientes e Histórico de Prendas Compradas</span>
          </h1>
          <p className="hidden sm:block text-sm text-slate-500">
            Selecciona cualquier cliente de la lista para desplegar la ventana con el{' '}
            <strong>histórico de prendas que ha comprado agrupadas en pedidos</strong>.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setMostrarNuevoCliente(!mostrarNuevoCliente)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 min-h-11 sm:min-h-0 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-rose-700 transition cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" /> Nuevo Cliente
        </button>
      </div>

      {mensajeExito && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {mensajeExito}
          </span>
          <button
            onClick={() => setMensajeExito(null)}
            className="underline ml-3 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Formulario de Alta de Cliente */}
      {mostrarNuevoCliente && (
        <form
          onSubmit={handleCrearCliente}
          className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs space-y-4"
        >
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-rose-600" /> Registrar Nuevo Cliente en Tutina
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              type="text"
              required
              placeholder="Nombre *"
              value={nuevoClienteForm.nombreCliente}
              onChange={(e) =>
                setNuevoClienteForm({ ...nuevoClienteForm, nombreCliente: e.target.value })
              }
              className="px-3 py-2 text-xs rounded-xl border border-slate-200"
            />
            <input
              type="text"
              required
              placeholder="Apellido *"
              value={nuevoClienteForm.apellidoCliente}
              onChange={(e) =>
                setNuevoClienteForm({ ...nuevoClienteForm, apellidoCliente: e.target.value })
              }
              className="px-3 py-2 text-xs rounded-xl border border-slate-200"
            />
            <input
              type="text"
              required
              placeholder="Teléfono WhatsApp *"
              value={nuevoClienteForm.telefonoCliente}
              onChange={(e) =>
                setNuevoClienteForm({ ...nuevoClienteForm, telefonoCliente: e.target.value })
              }
              className="px-3 py-2 text-xs font-mono rounded-xl border border-slate-200"
            />
            <input
              type="email"
              placeholder="Email (opcional)"
              value={nuevoClienteForm.emailCliente}
              onChange={(e) =>
                setNuevoClienteForm({ ...nuevoClienteForm, emailCliente: e.target.value })
              }
              className="px-3 py-2 text-xs rounded-xl border border-slate-200"
            />
            <input
              type="text"
              placeholder="DNI / CUIT (opcional)"
              value={nuevoClienteForm.dniCuit}
              onChange={(e) =>
                setNuevoClienteForm({ ...nuevoClienteForm, dniCuit: e.target.value })
              }
              className="px-3 py-2 text-xs rounded-xl border border-slate-200"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMostrarNuevoCliente(false)}
              className="px-3 py-1.5 text-xs text-slate-500 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardandoCliente}
              className="px-4 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
            >
              {guardandoCliente ? 'Guardando...' : 'Guardar Cliente'}
            </button>
          </div>
        </form>
      )}

      {/* Barra de Búsqueda */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar cliente por nombre, apellido, teléfono, DNI o correo..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>
        <span className="text-xs font-semibold text-slate-500 shrink-0">
          {clientesFiltrados.length} cliente(s) en la lista
        </span>
      </div>

      {/* Lista de Clientes */}
      {loading ? (
        <div className="p-12 text-center text-sm text-slate-500">
          Cargando lista de clientes de Tutina...
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-sm text-slate-500">
          No se encontraron clientes con ese criterio de búsqueda.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden divide-y divide-slate-100">
          {clientesFiltrados.map((cli) => {
            const totalPedidos = cli.pedidos.length;
            const totalPrendasCompradas = cli.pedidos.reduce(
              (acc, ped) =>
                acc + ped.detallesPedido.reduce((sum, det) => sum + det.Cantidad, 0),
              0
            );
            const montoTotalHistorico = cli.pedidos
              .filter((p) => !p.estadoActual.liberaStock)
              .reduce((acc, ped) => acc + ped.total, 0);
            const ultimaCompra = cli.pedidos[0]?.fechaPedido;

            return (
              <div
                key={cli.codCliente}
                onClick={() => setClienteSeleccionado(cli)}
                className="p-4 sm:p-5 hover:bg-rose-50/40 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer group"
              >
                {/* Datos Principales del Cliente */}
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 font-extrabold text-sm flex items-center justify-center shrink-0 border border-rose-200">
                    {cli.nombreCliente.charAt(0).toUpperCase()}
                    {cli.apellidoCliente.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-rose-600 transition">
                        {cli.apellidoCliente}, {cli.nombreCliente}
                      </h3>
                      {cli.dniCuit && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[11px]">
                          DNI: {cli.dniCuit}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 font-mono text-slate-700 font-medium">
                        <Phone className="w-3.5 h-3.5 text-emerald-600" /> {cli.telefonoCliente}
                      </span>
                      {cli.emailCliente && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-slate-400" /> {cli.emailCliente}
                        </span>
                      )}
                      {ultimaCompra && (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Clock className="w-3.5 h-3.5" /> Última compra:{' '}
                          {new Date(ultimaCompra).toLocaleDateString('es-AR')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Resumen de Actividad y Botón para Desplegar Ventana de Histórico */}
                <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-center px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="block text-[10px] font-bold uppercase text-slate-400">
                        Pedidos
                      </span>
                      <span className="font-extrabold text-slate-900">{totalPedidos}</span>
                    </div>

                    <div className="text-center px-3 py-1.5 rounded-xl bg-indigo-50/70 border border-indigo-200">
                      <span className="block text-[10px] font-bold uppercase text-indigo-600">
                        Prendas Compradas
                      </span>
                      <span className="font-extrabold text-indigo-900">
                        {totalPrendasCompradas} u.
                      </span>
                    </div>

                    <div className="text-right px-3 py-1.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                      <span className="block text-[10px] font-bold uppercase text-emerald-700">
                        Total Comprado
                      </span>
                      <span className="font-extrabold text-emerald-800">
                        ${montoTotalHistorico.toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold group-hover:bg-rose-600 transition shrink-0">
                    Ver Histórico de Prendas <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================================================================================= */}
      {/* VENTANA MODAL: HISTÓRICO DE PRENDAS COMPRADAS POR EL CLIENTE AGRUPADAS EN PEDIDOS */}
      {/* ================================================================================= */}
      {clienteSeleccionado && (
        <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-stretch sm:items-center justify-center sm:p-4 overflow-y-auto">
          <div className="bg-white sm:rounded-2xl max-w-4xl w-full sm:border border-slate-200 shadow-2xl overflow-hidden sm:my-8 flex flex-col h-dvh sm:h-auto sm:max-h-[88vh]">
            {/* Cabecera de la Ventana del Cliente */}
            <div className="px-4 sm:px-6 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] sm:py-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-rose-600 text-white font-extrabold text-sm flex items-center justify-center">
                  {clienteSeleccionado.nombreCliente.charAt(0).toUpperCase()}
                  {clienteSeleccionado.apellidoCliente.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold sm:flex items-center gap-2 truncate">
                    <span className="hidden sm:inline">Histórico de Prendas Compradas: </span>
                    <span className="sm:text-rose-400">
                      {clienteSeleccionado.apellidoCliente}, {clienteSeleccionado.nombreCliente}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 truncate">
                    WhatsApp: {clienteSeleccionado.telefonoCliente}
                    {clienteSeleccionado.dniCuit ? ` • DNI: ${clienteSeleccionado.dniCuit}` : ''}
                    {clienteSeleccionado.emailCliente
                      ? ` • ${clienteSeleccionado.emailCliente}`
                      : ''}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setClienteSeleccionado(null)}
                aria-label="Cerrar"
                className="touch-target -mr-2 shrink-0 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumen Superior del Cliente */}
            <div className="px-4 sm:px-6 py-3 sm:py-3.5 bg-slate-50 border-b border-slate-200 grid grid-cols-3 gap-2 sm:gap-3 text-xs shrink-0">
              <div className="flex items-center gap-2.5">
                <Hash className="hidden sm:block w-4 h-4 text-rose-600 shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">
                    <span className="sm:hidden">Pedidos</span>
                    <span className="hidden sm:inline">Pedidos Registrados</span>
                  </span>
                  <span className="font-extrabold text-slate-900">
                    {clienteSeleccionado.pedidos.length} pedido(s)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <ShoppingBag className="hidden sm:block w-4 h-4 text-indigo-600 shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">
                    <span className="sm:hidden">Prendas</span>
                    <span className="hidden sm:inline">Total Prendas Adquiridas</span>
                  </span>
                  <span className="font-extrabold text-indigo-700">
                    {clienteSeleccionado.pedidos.reduce(
                      (acc, p) =>
                        acc + p.detallesPedido.reduce((sum, d) => sum + d.Cantidad, 0),
                      0
                    )}{' '}
                    prendas
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Users className="hidden sm:block w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">
                    <span className="sm:hidden">Total</span>
                    <span className="hidden sm:inline">Total Acumulado en Compras</span>
                  </span>
                  <span className="font-extrabold text-emerald-700">
                    $
                    {clienteSeleccionado.pedidos
                      .filter((p) => !p.estadoActual.liberaStock)
                      .reduce((acc, p) => acc + p.total, 0)
                      .toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
            </div>

            {/* Cuerpo de la Ventana: Lista de Prendas Compradas Agrupadas en Pedidos */}
            <div className="p-3 sm:p-6 overflow-y-auto scroll-touch space-y-4 sm:space-y-5 flex-1 min-h-0">
              {clienteSeleccionado.pedidos.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 space-y-2">
                  <ShoppingBag className="w-9 h-9 text-slate-300 mx-auto" />
                  <p className="text-sm font-semibold">
                    Este cliente aún no registra pedidos ni prendas compradas.
                  </p>
                </div>
              ) : (
                clienteSeleccionado.pedidos.map((pedido) => {
                  const cantPrendasEnPedido = pedido.detallesPedido.reduce(
                    (acc, d) => acc + d.Cantidad,
                    0
                  );

                  return (
                    <div
                      key={pedido.nroPedido}
                      className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs"
                    >
                      {/* Encabezado de cada Grupo de Pedido */}
                      <div className="px-4 py-3 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <Link
                            href={`/pedidos?pedidoId=${pedido.nroPedido}`}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-mono font-bold hover:bg-rose-600 transition inline-flex items-center gap-1"
                            title="Seleccionar este pedido y abrirlo en Historial de Pedidos"
                          >
                            Pedido #{String(pedido.nroPedido).padStart(4, '0')}
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                          <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-rose-500" />
                            {new Date(pedido.fechaPedido).toLocaleDateString('es-AR', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 font-bold">
                            {pedido.estadoActual.nombreEP}
                          </span>
                        </div>

                        <div className="max-sm:w-full flex flex-wrap items-center gap-2">
                          <Link
                            href={`/pedidos?pedidoId=${pedido.nroPedido}`}
                            className="max-sm:w-full max-sm:justify-center inline-flex items-center gap-1.5 px-3 min-h-11 sm:min-h-0 py-1.5 rounded-xl bg-rose-600 text-white text-sm sm:text-xs font-bold hover:bg-rose-700 transition shadow-2xs"
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            {(pedido.totalAPagar ?? 0) > 0 && !pedido.estadoActual.liberaStock
                              ? 'Ir al Pedido / Registrar Entrega'
                              : 'Ver Pedido en Historial'}
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>

                      {/* Resumen de Saldos del Pedido: Total Pedido, Total Pagado, Total a Pagar */}
                      <div className="px-3 sm:px-4 py-2.5 bg-slate-50 border-b border-slate-200 grid grid-cols-3 gap-2 text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-2 sm:px-3 py-1.5 rounded-lg bg-white border border-slate-200">
                          <span className="font-bold text-slate-500 uppercase text-[10px]">
                            <span className="sm:hidden">Total</span>
                            <span className="hidden sm:inline">Total Pedido:</span>
                          </span>
                          <span className="font-extrabold text-slate-900">
                            ${pedido.total.toLocaleString('es-AR')}
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-2 sm:px-3 py-1.5 rounded-lg bg-emerald-50/70 border border-emerald-200">
                          <span className="font-bold text-emerald-800 uppercase text-[10px]">
                            <span className="sm:hidden">Pagado</span>
                            <span className="hidden sm:inline">Total Pagado:</span>
                          </span>
                          <span className="font-extrabold text-emerald-700">
                            ${(pedido.totalPagado ?? 0).toLocaleString('es-AR')}
                          </span>
                        </div>

                        <div
                          className={`flex flex-col sm:flex-row sm:items-center justify-between px-2 sm:px-3 py-1.5 rounded-lg border ${
                            (pedido.totalAPagar ?? 0) > 0 && !pedido.estadoActual.liberaStock
                              ? 'bg-rose-50 border-rose-300'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <span
                            className={`font-bold uppercase text-[10px] ${
                              (pedido.totalAPagar ?? 0) > 0 && !pedido.estadoActual.liberaStock
                                ? 'text-rose-800'
                                : 'text-slate-500'
                            }`}
                          >
                            <span className="sm:hidden">Saldo</span>
                            <span className="hidden sm:inline">Total a Pagar:</span>
                          </span>
                          <span
                            className={`font-extrabold ${
                              (pedido.totalAPagar ?? 0) > 0 && !pedido.estadoActual.liberaStock
                                ? 'text-rose-600'
                                : 'text-slate-600'
                            }`}
                          >
                            $
                            {(pedido.estadoActual.liberaStock
                              ? 0
                              : pedido.totalAPagar ?? 0
                            ).toLocaleString('es-AR')}
                          </span>
                        </div>
                      </div>

                      {/* Lista de Prendas Compradas en este Pedido */}
                      <div className="divide-y divide-slate-100">
                        {pedido.detallesPedido.map((det) => {
                          const imgPrenda =
                            det.variante.imagenVariante || det.variante.producto.imagen;
                          return (
                            <div
                              key={det.idDetallePedido}
                              className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition text-xs"
                            >
                              <div className="flex items-center gap-3.5 min-w-0">
                                {/* Miniatura de la prenda comprada */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={imgPrenda}
                                  alt={det.variante.producto.nombre}
                                  className="w-12 h-14 rounded-xl object-cover border border-slate-200 bg-slate-100 shrink-0"
                                />

                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-bold text-slate-900 text-sm">
                                      {det.variante.producto.nombre}
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-semibold text-[10px]">
                                      {det.variante.producto.marca.nombreMarca}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 text-slate-500">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                                      Talle: {det.variante.talle.nombreTalle}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                                      <span
                                        className="w-2.5 h-2.5 rounded-full border border-slate-300"
                                        style={{
                                          backgroundColor: det.variante.color.codigoHex,
                                        }}
                                      />
                                      Color: {det.variante.color.nombreColor}
                                    </span>
                                    <span className="font-mono text-[11px] text-slate-400">
                                      <Tag className="w-3 h-3 inline mr-0.5" />
                                      {det.variante.sku}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Cantidad y Precios pagados en esa compra */}
                              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                                <div className="text-right">
                                  <span className="block text-[11px] text-slate-500">
                                    Cantidad: <strong>{det.Cantidad} u.</strong> × $
                                    {det.precioUnitarioNeto.toLocaleString('es-AR')}
                                  </span>
                                  {det.porcentajeDescuentoAplicado > 0 && (
                                    <span className="text-[10px] font-bold text-rose-600">
                                      (Con -{det.porcentajeDescuentoAplicado}% dto. aplicado)
                                    </span>
                                  )}
                                </div>

                                <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-extrabold text-slate-900 min-w-[95px] text-right">
                                  ${det.subtotal.toLocaleString('es-AR')}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="px-4 py-2 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span>
                          Total de prendas en este pedido: <strong>{cantPrendasEnPedido} u.</strong>
                        </span>
                        {pedido.observaciones && (
                          <span className="italic">Nota: {pedido.observaciones}</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pie de la Ventana */}
            <div className="px-4 sm:px-6 pt-3 pb-safe-4 sm:py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setClienteSeleccionado(null)}
                className="max-sm:w-full min-h-12 sm:min-h-0 px-5 py-2 rounded-xl bg-slate-900 text-white text-sm sm:text-xs font-bold hover:bg-rose-600 transition cursor-pointer"
              >
                <span className="sm:hidden">Cerrar</span>
                <span className="hidden sm:inline">Cerrar Histórico del Cliente</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
