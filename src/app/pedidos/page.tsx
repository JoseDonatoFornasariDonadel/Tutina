'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  PlusCircle,
  Clock,
  CheckCircle2,
  User,
  CreditCard,
  History,
  RefreshCcw,
  RotateCcw,
  AlertCircle,
  Banknote,
  X,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { useAppConfig } from '@/components/layout/AppShell';

interface EstadoPedidoItem {
  codEP: number;
  nombreEP: string;
  colorBadge: string;
  reservaStock: boolean;
  liberaStock: boolean;
}

interface FormaPagoItem {
  codFP: number;
  nombreFP: string;
  porcentajeComisionActual: number;
}

interface PedidoHist {
  nroPedido: number;
  fechaPedido: string;
  canalVenta: string;
  subtotalBruto: number;
  montoDescuentosTotal: number;
  total: number;
  totalPagado: number;
  totalAPagar: number;
  codEstadoActual: number;
  cliente: {
    codCliente: number;
    nombreCliente: string;
    apellidoCliente: string;
    telefonoCliente: string;
  };
  estadoActual: EstadoPedidoItem;
  historialEstados: {
    idPedidoEstado: number;
    fechaInicioPE: string;
    fechaFinPE: string | null;
    motivoCambio: string | null;
    estadoPedido: { nombreEP: string };
  }[];
  formasPago: {
    idPedidoFormaPago?: number;
    montoPFP: number;
    fechaPFP?: string;
    comprobanteReferencia?: string | null;
    porcentajeComisionAplicado: number;
    montoComisionCalculado: number;
    formaPago: { nombreFP: string };
  }[];
  detallesPedido: {
    idDetallePedido: number;
    Cantidad: number;
    precioUnitarioVenta: number;
    porcentajeDescuentoAplicado: number;
    precioUnitarioNeto: number;
    precioUnitarioCostoHistorico: number;
    subtotal: number;
    variante: {
      sku: string;
      producto: { nombre: string };
      talle: { nombreTalle: string };
      color: { nombreColor: string };
    };
  }[];
}

function HistorialPedidosContent() {
  const { refreshGlobalState } = useAppConfig();
  const searchParams = useSearchParams();
  const pedidoIdParam = searchParams.get('pedidoId');
  const pedidoResaltadoId = pedidoIdParam ? Number(pedidoIdParam) : null;

  const [pedidos, setPedidos] = useState<PedidoHist[]>([]);
  const [estados, setEstados] = useState<EstadoPedidoItem[]>([]);
  const [formasPagoDisponibles, setFormasPagoDisponibles] = useState<FormaPagoItem[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [loading, setLoading] = useState(true);
  const [cambiandoId, setCambiandoId] = useState<number | null>(null);
  const [avisoEstado, setAvisoEstado] = useState<string | null>(null);

  // Estado para el formulario de Registrar Entrega Parcial en un pedido
  const [pedidoConEntregaAbierta, setPedidoConEntregaAbierta] = useState<number | null>(null);
  // En celular el detalle (prendas, pagos, historial) de cada pedido se abre con un toque
  const [detallesAbiertos, setDetallesAbiertos] = useState<Set<number>>(new Set());
  const alternarDetalle = (nro: number) =>
    setDetallesAbiertos((prev) => {
      const sig = new Set(prev);
      if (sig.has(nro)) sig.delete(nro);
      else sig.add(nro);
      return sig;
    });
  const [montoEntregaInput, setMontoEntregaInput] = useState<string>('');
  const [codFPSeleccionada, setCodFPSeleccionada] = useState<number>(0);
  const [notaEntregaInput, setNotaEntregaInput] = useState<string>('');
  const [registrandoEntrega, setRegistrandoEntrega] = useState(false);

  const cargarPedidos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pedidos', { cache: 'no-store' });
      const data = await res.json();
      const listaPedidos: PedidoHist[] = data.pedidos || [];
      const listaFP: FormaPagoItem[] = data.formasPago || [];

      setPedidos(listaPedidos);
      setEstados(data.estados || []);
      setFormasPagoDisponibles(listaFP);
      if (listaFP.length > 0 && !codFPSeleccionada) {
        setCodFPSeleccionada(listaFP[0].codFP);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarPedidos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si venimos redireccionados desde Clientes (?pedidoId=XX), hacer scroll automático al pedido y abrir su panel de entrega si tiene saldo a pagar
  useEffect(() => {
    if (!loading && pedidoResaltadoId && pedidos.length > 0) {
      setFiltroEstado('TODOS');
      const pedObj = pedidos.find((p) => p.nroPedido === pedidoResaltadoId);
      if (pedObj && pedObj.totalAPagar > 0 && !pedObj.estadoActual.liberaStock) {
        setPedidoConEntregaAbierta(pedObj.nroPedido);
        setMontoEntregaInput(String(pedObj.totalAPagar));
      }
      setTimeout(() => {
        const el = document.getElementById(`pedido-card-${pedidoResaltadoId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
  }, [loading, pedidoResaltadoId, pedidos]);

  const estadoDevuelto = useMemo(
    () => estados.find((e) => e.liberaStock || e.nombreEP.toLowerCase().includes('devuelto')),
    [estados]
  );

  const estadoPagado = useMemo(
    () =>
      estados.find(
        (e) =>
          e.nombreEP.toLowerCase().includes('pagado y entregado') ||
          (e.nombreEP.toLowerCase().includes('pagado') &&
            !e.nombreEP.toLowerCase().includes('pendiente'))
      ),
    [estados]
  );

  const pedidosFiltrados = useMemo(() => {
    if (filtroEstado === 'TODOS') return pedidos;
    return pedidos.filter((p) => p.codEstadoActual === Number(filtroEstado));
  }, [pedidos, filtroEstado]);

  const abrirPanelEntregaParcial = (ped: PedidoHist) => {
    if (pedidoConEntregaAbierta === ped.nroPedido) {
      setPedidoConEntregaAbierta(null);
      return;
    }
    setPedidoConEntregaAbierta(ped.nroPedido);
    setMontoEntregaInput(String(ped.totalAPagar > 0 ? ped.totalAPagar : ped.total));
    setNotaEntregaInput('');
    if (formasPagoDisponibles.length > 0 && !codFPSeleccionada) {
      setCodFPSeleccionada(formasPagoDisponibles[0].codFP);
    }
  };

  const handleRegistrarEntregaParcial = async (e: React.FormEvent, ped: PedidoHist) => {
    e.preventDefault();
    const montoNum = Number(montoEntregaInput);
    if (!montoNum || montoNum <= 0) {
      alert('Ingresa un monto de entrega mayor a $0.');
      return;
    }

    setRegistrandoEntrega(true);
    setAvisoEstado(null);
    try {
      const res = await fetch('/api/pedidos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoOperacion: 'ENTREGA_PARCIAL',
          nroPedido: ped.nroPedido,
          montoEntrega: montoNum,
          codFP: codFPSeleccionada || formasPagoDisponibles[0]?.codFP,
          comprobanteReferencia: notaEntregaInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar la entrega parcial');
      }

      const saldoRestante = data.totalAPagar ?? 0;
      setAvisoEstado(
        saldoRestante === 0
          ? `¡Entrega registrada en Pedido #${String(ped.nroPedido).padStart(
              4,
              '0'
            )}! El pedido quedó 100% saldado ($0 a pagar) y pasó a estado "${
              data.estadoActual?.nombreEP || 'Pagado'
            }".`
          : `Entrega parcial de $${montoNum.toLocaleString(
              'es-AR'
            )} registrada en Pedido #${String(ped.nroPedido).padStart(
              4,
              '0'
            )}. Total pagado: $${(data.totalPagado ?? 0).toLocaleString(
              'es-AR'
            )} | Total a pagar restante: $${saldoRestante.toLocaleString('es-AR')}.`
      );

      setPedidoConEntregaAbierta(null);
      setMontoEntregaInput('');
      setNotaEntregaInput('');
      await cargarPedidos();
      await refreshGlobalState();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al registrar entrega');
    } finally {
      setRegistrandoEntrega(false);
    }
  };

  const handleCambiarEstado = async (
    nroPedido: number,
    nuevoCodEP: number,
    motivoPersonalizado?: string
  ) => {
    setCambiandoId(nroPedido);
    setAvisoEstado(null);
    try {
      const destino = estados.find((e) => e.codEP === nuevoCodEP);
      const res = await fetch('/api/pedidos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nroPedido,
          nuevoCodEP,
          motivoCambio:
            motivoPersonalizado ||
            `Cambio de estado a "${destino?.nombreEP || 'Nuevo estado'}" en Historial de Pedidos`,
        }),
      });
      if (res.ok) {
        if (destino?.liberaStock) {
          setAvisoEstado(
            `Pedido #${String(nroPedido).padStart(
              4,
              '0'
            )} marcado como "${destino.nombreEP}". Se reintegraron automáticamente las unidades al stock del catálogo.`
          );
        } else {
          setAvisoEstado(
            `Estado del Pedido #${String(nroPedido).padStart(4, '0')} actualizado a "${
              destino?.nombreEP
            }".`
          );
        }
        await cargarPedidos();
        await refreshGlobalState();
      }
    } finally {
      setCambiandoId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-row items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Trazabilidad de Estados, Entregas Parciales y Devoluciones
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 sm:mt-1">
            <span className="sm:hidden">Pedidos</span>
            <span className="hidden sm:inline">Historial de Pedidos, Pagos y Saldos</span>
          </h1>
          <p className="hidden sm:block text-sm text-slate-500">
            Controla el <strong>Total del Pedido</strong>, <strong>Total Pagado</strong> y{' '}
            <strong>Total a Pagar</strong>, registrando entregas parciales o devoluciones en tiempo
            real.
          </p>
        </div>
        <Link
          href="/pedidos/nuevo"
          className="inline-flex items-center gap-2 px-4 min-h-11 sm:min-h-0 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition shrink-0"
        >
          <PlusCircle className="w-4 h-4" /> Nuevo Pedido
        </Link>
      </div>

      {/* Filtro rápido por Estado de Pedido */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 flex flex-nowrap sm:flex-wrap items-center gap-2 scroll-chips scroll-px-3">
        <span className="hidden sm:inline text-xs font-bold text-slate-500 mr-1">Filtrar por estado:</span>
        <button
          type="button"
          onClick={() => setFiltroEstado('TODOS')}
          className={`shrink-0 px-3 min-h-10 sm:min-h-0 py-1.5 rounded-xl text-sm sm:text-xs font-bold transition cursor-pointer ${
            filtroEstado === 'TODOS'
              ? 'bg-slate-900 text-white dark:ring-2 dark:ring-inset dark:ring-rose-500'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Todos ({pedidos.length})
        </button>
        {estados.map((ep) => {
          const count = pedidos.filter((p) => p.codEstadoActual === ep.codEP).length;
          return (
            <button
              key={ep.codEP}
              type="button"
              onClick={() => setFiltroEstado(String(ep.codEP))}
              className={`shrink-0 px-3 min-h-10 sm:min-h-0 py-1.5 rounded-xl text-sm sm:text-xs font-bold transition cursor-pointer ${
                filtroEstado === String(ep.codEP)
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {ep.nombreEP} ({count})
            </button>
          );
        })}
      </div>

      {avisoEstado && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {avisoEstado}
          </span>
          <button
            onClick={() => setAvisoEstado(null)}
            className="underline ml-3 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-sm text-slate-500">Cargando pedidos...</div>
      ) : (
        <div className="space-y-4">
          {pedidosFiltrados.map((ped) => {
            const cmvPedido = ped.detallesPedido.reduce(
              (acc, d) => acc + d.Cantidad * d.precioUnitarioCostoHistorico,
              0
            );
            const comisiones = ped.formasPago.reduce(
              (acc, f) => acc + f.montoComisionCalculado,
              0
            );
            const margenContribucion = ped.total - cmvPedido - comisiones;
            const esEntregadoPendientePago = ped.estadoActual.nombreEP
              .toLowerCase()
              .includes('entregado y pendiente de pago');
            const estaDevuelto = ped.estadoActual.liberaStock;
            const totalPagado = ped.totalPagado ?? 0;
            const totalAPagar = ped.totalAPagar ?? Math.max(0, ped.total - totalPagado);
            const tieneSaldoPendiente = totalAPagar > 0 && !estaDevuelto;
            const esPedidoResaltado = pedidoResaltadoId === ped.nroPedido;
            const panelEntregaAbierto = pedidoConEntregaAbierta === ped.nroPedido;
            const detalleAbierto = esPedidoResaltado || detallesAbiertos.has(ped.nroPedido);
            const cantidadPrendas = ped.detallesPedido.reduce((acc, d) => acc + d.Cantidad, 0);

            return (
              <div
                id={`pedido-card-${ped.nroPedido}`}
                key={ped.nroPedido}
                className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs space-y-3 sm:space-y-4 transition-all ${
                  esPedidoResaltado
                    ? 'border-2 border-rose-500 ring-2 ring-rose-500/20'
                    : 'border-slate-200'
                }`}
              >
                {/* Cabecera del Pedido */}
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-slate-100 pb-3 sm:pb-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="px-3 py-1 rounded-xl bg-slate-900 text-white font-mono text-sm font-bold">
                      Pedido #{String(ped.nroPedido).padStart(4, '0')}
                    </span>
                    {esPedidoResaltado && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[11px] font-bold">
                        <Sparkles className="w-3 h-3" /> Seleccionado desde Clientes
                      </span>
                    )}
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(ped.fechaPedido).toLocaleDateString('es-AR')}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg">
                      <User className="w-3.5 h-3.5 text-rose-600" />
                      {ped.cliente.apellidoCliente}, {ped.cliente.nombreCliente} (
                      {ped.cliente.telefonoCliente})
                    </span>

                    {tieneSaldoPendiente && (
                      <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Resta abonar $
                        {totalAPagar.toLocaleString('es-AR')}
                      </span>
                    )}
                  </div>

                  {/* Acciones Rápidas: Entrega Parcial, Marcar Cobrado, Devolver, Cambiar Estado */}
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                    {tieneSaldoPendiente && (
                      <button
                        type="button"
                        onClick={() => abrirPanelEntregaParcial(ped)}
                        className={`inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 min-h-11 sm:min-h-0 py-1.5 rounded-xl text-sm sm:text-xs font-bold transition cursor-pointer shadow-2xs ${
                          panelEntregaAbierto
                            ? 'bg-slate-900 text-white'
                            : 'bg-rose-600 text-white hover:bg-rose-700'
                        }`}
                      >
                        <Banknote className="w-4 h-4 shrink-0" />
                        <span className="sm:hidden">{panelEntregaAbierto ? 'Cerrar' : 'Registrar pago'}</span>
                        <span className="hidden sm:inline">
                          {panelEntregaAbierto
                            ? 'Cerrar Entrega Parcial'
                            : 'Registrar Entrega Parcial'}
                        </span>
                      </button>
                    )}

                    {esEntregadoPendientePago && estadoPagado && (
                      <button
                        type="button"
                        disabled={cambiandoId === ped.nroPedido}
                        onClick={() =>
                          handleCambiarEstado(
                            ped.nroPedido,
                            estadoPagado.codEP,
                            'Cobro total recibido de pedido que estaba entregado y pendiente de pago'
                          )
                        }
                        className="inline-flex items-center justify-center gap-1 px-3 min-h-11 sm:min-h-0 py-1.5 rounded-xl bg-emerald-600 text-white text-sm sm:text-xs font-bold hover:bg-emerald-700 transition cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Saldar Total
                      </button>
                    )}

                    {!estaDevuelto && estadoDevuelto && (
                      <button
                        type="button"
                        disabled={cambiandoId === ped.nroPedido}
                        onClick={() =>
                          handleCambiarEstado(
                            ped.nroPedido,
                            estadoDevuelto.codEP,
                            `Devolución registrada desde estado "${ped.estadoActual.nombreEP}" (Stock reintegrado)`
                          )
                        }
                        className="inline-flex items-center justify-center gap-1 px-3 min-h-11 sm:min-h-0 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-sm sm:text-xs font-bold hover:bg-rose-100 transition cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                        <span className="sm:hidden">Devolver</span>
                        <span className="hidden sm:inline">Devolver Prendas</span>
                      </button>
                    )}

                    <div className="col-span-2 flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-500">Estado:</span>
                      <select
                        disabled={cambiandoId === ped.nroPedido}
                        value={ped.codEstadoActual}
                        onChange={(e) =>
                          handleCambiarEstado(ped.nroPedido, Number(e.target.value))
                        }
                        className="flex-1 sm:flex-none min-w-0 px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50"
                      >
                        {estados.map((ep) => (
                          <option key={ep.codEP} value={ep.codEP}>
                            {ep.nombreEP}
                          </option>
                        ))}
                      </select>
                      {cambiandoId === ped.nroPedido && (
                        <RefreshCcw className="w-4 h-4 animate-spin text-rose-600" />
                      )}
                    </div>
                  </div>
                </div>

                {/* RESUMEN FINANCIERO DEL PEDIDO: TOTAL PEDIDO | TOTAL PAGADO | TOTAL A PAGAR */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 p-2 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="p-2 sm:p-2.5 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-0.5">
                    <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase">
                      <span className="sm:hidden">Total</span>
                      <span className="hidden sm:inline">Total del Pedido</span>
                    </span>
                    <span className="text-sm sm:text-base font-extrabold text-slate-900">
                      ${ped.total.toLocaleString('es-AR')}
                    </span>
                  </div>

                  <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-0.5">
                    <span className="text-[11px] sm:text-xs font-bold text-emerald-800 uppercase">
                      <span className="sm:hidden">Pagado</span>
                      <span className="hidden sm:inline">Total Pagado</span>
                    </span>
                    <span className="text-sm sm:text-base font-extrabold text-emerald-700">
                      ${totalPagado.toLocaleString('es-AR')}
                    </span>
                  </div>

                  <div
                    className={`p-2 sm:p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 ${
                      totalAPagar > 0 && !estaDevuelto
                        ? 'bg-rose-50 border-rose-300'
                        : 'bg-slate-100 border-slate-200'
                    }`}
                  >
                    <span
                      className={`text-[11px] sm:text-xs font-bold uppercase ${
                        totalAPagar > 0 && !estaDevuelto ? 'text-rose-800' : 'text-slate-500'
                      }`}
                    >
                      <span className="sm:hidden">Saldo</span>
                      <span className="hidden sm:inline">Total a Pagar</span>
                    </span>
                    <span
                      className={`text-sm sm:text-base font-extrabold ${
                        totalAPagar > 0 && !estaDevuelto ? 'text-rose-600' : 'text-slate-600'
                      }`}
                    >
                      ${(estaDevuelto ? 0 : totalAPagar).toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>

                {/* FORMULARIO DESPLEGABLE PARA REGISTRAR ENTREGA PARCIAL */}
                {panelEntregaAbierto && tieneSaldoPendiente && (
                  <form
                    onSubmit={(e) => handleRegistrarEntregaParcial(e, ped)}
                    className="p-4 rounded-2xl bg-rose-50/60 border-2 border-rose-300 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
                          <Banknote className="w-4 h-4 text-rose-600" /> Registrar Entrega Parcial o
                          Cancelación de Saldo • Pedido #{String(ped.nroPedido).padStart(4, '0')}
                        </h4>
                        <p className="text-[11px] text-slate-600">
                          Ingresa cuánto dinero entrega hoy el cliente. El sistema descontará el
                          monto de <strong>Total a Pagar (${totalAPagar.toLocaleString('es-AR')})</strong> y
                          lo sumará a <strong>Total Pagado</strong>.
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setMontoEntregaInput(String(Math.round(totalAPagar / 2)))}
                          className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-[11px] font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
                        >
                          50% (${Math.round(totalAPagar / 2).toLocaleString('es-AR')})
                        </button>
                        <button
                          type="button"
                          onClick={() => setMontoEntregaInput(String(totalAPagar))}
                          className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                        >
                          Saldar Total (${totalAPagar.toLocaleString('es-AR')})
                        </button>
                        <button
                          type="button"
                          onClick={() => setPedidoConEntregaAbierta(null)}
                          className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Monto Entregado ($) *
                        </label>
                        <input
                          type="number"
                inputMode="decimal"
                          required
                          min={1}
                          max={totalAPagar}
                          step="any"
                          value={montoEntregaInput}
                          onChange={(e) => setMontoEntregaInput(e.target.value)}
                          placeholder={`Máx: ${totalAPagar}`}
                          className="w-full px-3 py-2 text-sm font-extrabold rounded-xl border border-slate-300 bg-white"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Medio de Pago
                        </label>
                        <select
                          value={codFPSeleccionada}
                          onChange={(e) => setCodFPSeleccionada(Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white"
                        >
                          {formasPagoDisponibles.map((fp) => (
                            <option key={fp.codFP} value={fp.codFP}>
                              {fp.nombreFP}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Nota / Detalle de la Entrega (Opcional)
                        </label>
                        <input
                          type="text"
                          value={notaEntregaInput}
                          onChange={(e) => setNotaEntregaInput(e.target.value)}
                          placeholder="Ej: Entregó efectivo a cuenta en el local"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <button
                          type="submit"
                          disabled={registrandoEntrega}
                          className="w-full py-2 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          {registrandoEntrega ? 'Guardando...' : 'Confirmar Entrega'}
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* Celular: el detalle se abre con un toque para que la lista de pedidos sea corta */}
                <button
                  type="button"
                  onClick={() => alternarDetalle(ped.nroPedido)}
                  aria-expanded={detalleAbierto}
                  className="sm:hidden w-full min-h-11 flex items-center justify-between gap-2 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 cursor-pointer"
                >
                  <span>
                    {detalleAbierto ? 'Ocultar detalle' : 'Ver detalle'} • {cantidadPrendas}{' '}
                    {cantidadPrendas === 1 ? 'prenda' : 'prendas'}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 transition-transform ${
                      detalleAbierto ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Detalle de Prendas del Pedido: lista compacta en móvil */}
                <ul className={`sm:hidden divide-y divide-slate-100 text-sm ${detalleAbierto ? '' : 'hidden'}`}>
                  {ped.detallesPedido.map((d) => (
                    <li key={d.idDetallePedido} className="py-2.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">
                          {d.variante.producto.nombre}
                        </div>
                        <div className="text-xs text-slate-500">
                          {d.variante.talle.nombreTalle} • {d.variante.color.nombreColor} •{' '}
                          {d.Cantidad} × ${d.precioUnitarioVenta.toLocaleString('es-AR')}
                          {d.porcentajeDescuentoAplicado > 0 &&
                            ` (-${d.porcentajeDescuentoAplicado}%)`}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-slate-900">
                          ${d.subtotal.toLocaleString('es-AR')}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Costo ${d.precioUnitarioCostoHistorico.toLocaleString('es-AR')}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Tabla completa desde sm */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-400 border-b border-slate-100">
                      <tr>
                        <th className="py-2">Prenda / Variante</th>
                        <th className="py-2 text-center">Cant.</th>
                        <th className="py-2 text-right">Precio Venta Unit.</th>
                        <th className="py-2 text-right">Dto.</th>
                        <th className="py-2 text-right">Costo Histórico Congelado</th>
                        <th className="py-2 text-right">Subtotal Venta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {ped.detallesPedido.map((d) => (
                        <tr key={d.idDetallePedido}>
                          <td className="py-2 font-medium text-slate-800">
                            {d.variante.producto.nombre}{' '}
                            <span className="text-slate-400">
                              ({d.variante.talle.nombreTalle} - {d.variante.color.nombreColor})
                            </span>
                          </td>
                          <td className="py-2 text-center font-bold">{d.Cantidad}</td>
                          <td className="py-2 text-right">
                            ${d.precioUnitarioVenta.toLocaleString('es-AR')}
                          </td>
                          <td className="py-2 text-right">
                            {d.porcentajeDescuentoAplicado > 0
                              ? `-${d.porcentajeDescuentoAplicado}%`
                              : '—'}
                          </td>
                          <td className="py-2 text-right text-slate-500">
                            ${d.precioUnitarioCostoHistorico.toLocaleString('es-AR')}
                          </td>
                          <td className="py-2 text-right font-bold text-slate-900">
                            ${d.subtotal.toLocaleString('es-AR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pie con Historial de Pagos / Entregas Parciales, Historial Estados y Margen */}
                <div
                  className={`pt-3 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs ${
                    detalleAbierto ? '' : 'max-sm:hidden'
                  }`}
                >
                  <div className="flex flex-col gap-1.5 text-slate-600">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                        Pagos / Entregas registradas:
                      </span>
                      {ped.formasPago.length === 0 ? (
                        <span className="text-rose-600 font-semibold">
                          Sin entregas registradas aún ($0 pagado)
                        </span>
                      ) : (
                        ped.formasPago.map((fp, idx) => (
                          <span
                            key={fp.idPedidoFormaPago ?? idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium"
                          >
                            <strong>${fp.montoPFP.toLocaleString('es-AR')}</strong> (
                            {fp.formaPago.nombreFP}
                            {fp.fechaPFP
                              ? ` • ${new Date(fp.fechaPFP).toLocaleDateString('es-AR')}`
                              : ''}
                            {fp.comprobanteReferencia ? ` - ${fp.comprobanteReferencia}` : ''})
                          </span>
                        ))
                      )}
                    </div>

                    <span className="flex items-center gap-1.5 text-slate-500">
                      <History className="w-3.5 h-3.5 shrink-0" />
                      Historial Estados:{' '}
                      {ped.historialEstados
                        .map(
                          (h) =>
                            `${h.estadoPedido.nombreEP} (${new Date(
                              h.fechaInicioPE
                            ).toLocaleDateString('es-AR')}${h.fechaFinPE ? ' ✓' : ' • Vigente'})`
                        )
                        .join(' → ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 self-end lg:self-auto shrink-0">
                    <span className="text-slate-500">
                      Margen Contribución Pedido:{' '}
                      <strong className="text-emerald-700">
                        +${margenContribucion.toLocaleString('es-AR')}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function HistorialPedidosPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-sm text-slate-500">
          Cargando historial de pedidos...
        </div>
      }
    >
      <HistorialPedidosContent />
    </Suspense>
  );
}
