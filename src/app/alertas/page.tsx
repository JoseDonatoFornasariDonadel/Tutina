'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MessageSquareWarning,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Truck,
  PhoneCall,
  Clock,
  User,
  ShoppingBag,
  Check,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import { useAppConfig } from '@/components/layout/AppShell';

interface VarianteCritica {
  codVariante: number;
  sku: string;
  stock: number;
  alertaStockEnviada: boolean;
  producto: {
    nombre: string;
    marca: { nombreMarca: string };
    proveedorHabitual?: { nombreProveedor: string; numeroProveedor: string } | null;
  };
  talle: { nombreTalle: string };
  color: { nombreColor: string; codigoHex: string };
}

interface PedidoPendienteAlerta {
  nroPedido: number;
  fechaPedido: string;
  fechaInicioEstado: string;
  fechaReferencia?: string;
  diasEnEstado: number;
  total: number;
  observaciones?: string | null;
  cliente: {
    codCliente: number;
    nombreCliente: string;
    apellidoCliente: string;
    telefonoCliente: string;
    emailCliente?: string | null;
  };
  estadoActual: {
    codEP: number;
    nombreEP: string;
  };
  detallesPedido: {
    idDetallePedido: number;
    Cantidad: number;
    subtotal: number;
    variante: {
      sku: string;
      producto: {
        nombre: string;
        marca: { nombreMarca: string };
      };
      talle: { nombreTalle: string };
      color: { nombreColor: string };
    };
  }[];
}

interface AlertaLog {
  idAlerta: number;
  fechaDisparo: string;
  telefonoDestino: string;
  mensajeEnviado: string;
  stockRemanente: number;
  estadoEnvio: string;
  origenDisparo: string;
  variante: {
    sku: string;
    producto: { nombre: string };
    talle: { nombreTalle: string };
    color: { nombreColor: string };
  };
}

export default function AlertasWhatsAppPage() {
  const { refreshGlobalState } = useAppConfig();
  const [variantesCriticas, setVariantesCriticas] = useState<VarianteCritica[]>([]);
  const [pedidosPendientesVencidos, setPedidosPendientesVencidos] = useState<
    PedidoPendienteAlerta[]
  >([]);
  const [pedidosPendientesEnPlazo, setPedidosPendientesEnPlazo] = useState<
    PedidoPendienteAlerta[]
  >([]);
  const [umbralDiasPendientePago, setUmbralDiasPendientePago] = useState(5);
  const [codEstadoPagado, setCodEstadoPagado] = useState<number | null>(null);
  const [alertasLog, setAlertasLog] = useState<AlertaLog[]>([]);
  const [umbralGlobal, setUmbralGlobal] = useState(3);
  const [telefonoDestino, setTelefonoDestino] = useState('');
  const [loading, setLoading] = useState(true);
  const [procesandoPedidoId, setProcesandoPedidoId] = useState<number | null>(null);

  const cargarAlertas = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alertas', { cache: 'no-store' });
      const data = await res.json();
      setVariantesCriticas(data.variantesCriticas || []);
      setPedidosPendientesVencidos(data.pedidosPendientesVencidos || []);
      setPedidosPendientesEnPlazo(data.pedidosPendientesEnPlazo || []);
      setUmbralDiasPendientePago(data.umbralDiasPendientePago ?? 5);
      setCodEstadoPagado(data.codEstadoPagado ?? null);
      setAlertasLog(data.alertasLog || []);
      setUmbralGlobal(data.umbralGlobal ?? 3);
      setTelefonoDestino(data.telefonoDestino || '+5493516543210');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarAlertas();
  }, []);

  const marcarPedidoComoPagado = async (nroPedido: number) => {
    if (!codEstadoPagado) return;
    setProcesandoPedidoId(nroPedido);
    try {
      const res = await fetch('/api/pedidos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nroPedido,
          nuevoCodEP: codEstadoPagado,
          motivoCambio: `Cobro registrado desde panel de Alertas (${umbralDiasPendientePago}+ días pendiente)`,
        }),
      });
      if (res.ok) {
        await cargarAlertas();
        await refreshGlobalState();
      }
    } finally {
      setProcesandoPedidoId(null);
    }
  };

  const totalMontoVencido = pedidosPendientesVencidos.reduce((acc, p) => acc + p.total, 0);

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
              Regla Crítica RN-04 • Stock &lt; {umbralGlobal} unidades
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
              Control de Cobranza • Entregado y pendiente de pago &ge; {umbralDiasPendientePago}{' '}
              días
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1.5">
            Centro de Alertas de Stock y Cobranzas Pendientes
          </h1>
          <p className="text-sm text-slate-500">
            Supervisa las variantes con stock crítico (&lt; {umbralGlobal} u.) y los pedidos en
            estado <strong>&ldquo;Entregado y pendiente de pago&rdquo;</strong> que llevan{' '}
            <strong>{umbralDiasPendientePago} días o más</strong> sin abonarse.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href="/pedidos"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition"
          >
            <Clock className="w-4 h-4" /> Gestionar Pedidos
          </Link>
          <Link
            href="/proveedores"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
          >
            <Truck className="w-4 h-4" /> Cargar Factura de Reposición
          </Link>
        </div>
      </div>

      {/* NUEVO APARTADO: Alertas de Pedidos en "Entregado y pendiente de pago" >= 5 días */}
      <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-rose-600" /> Alertas de Pedidos &ldquo;Entregado y
              pendiente de pago&rdquo; ({umbralDiasPendientePago} días o más)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Se listan automáticamente los pedidos cuyas prendas ya fueron entregadas al cliente y
              acumulan {umbralDiasPendientePago} o más días corridos pendientes de pago.
            </p>
          </div>

          {pedidosPendientesVencidos.length > 0 && (
            <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 px-3.5 py-2 rounded-xl shrink-0">
              <div>
                <div className="text-[11px] font-semibold text-rose-700 uppercase">
                  Total vencido por cobrar ({pedidosPendientesVencidos.length}{' '}
                  {pedidosPendientesVencidos.length === 1 ? 'pedido' : 'pedidos'})
                </div>
                <div className="text-base font-extrabold text-rose-800">
                  ${totalMontoVencido.toLocaleString('es-AR')}
                </div>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-xs text-slate-500">
            Verificando antigüedad de pedidos pendientes de pago...
          </p>
        ) : pedidosPendientesVencidos.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-medium">
            ¡Al día! No hay ningún pedido en estado &ldquo;Entregado y pendiente de pago&rdquo; que
            haya superado los {umbralDiasPendientePago} días.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pedidosPendientesVencidos.map((pedido) => {
              const nombreCompleto = `${pedido.cliente.nombreCliente} ${pedido.cliente.apellidoCliente}`;
              const resumenPrendas = pedido.detallesPedido
                .map(
                  (d) =>
                    `${d.Cantidad}x ${d.variante.producto.nombre} (${d.variante.talle.nombreTalle}/${d.variante.color.nombreColor})`
                )
                .join(', ');

              const mensajeClienteWsp = encodeURIComponent(
                `Hola ${pedido.cliente.nombreCliente}! Te escribimos de Tutina para recordarte el pago pendiente del Pedido #${String(
                  pedido.nroPedido
                ).padStart(4, '0')} (${resumenPrendas}) por un total de $${pedido.total.toLocaleString(
                  'es-AR'
                )}, pendiente desde hace ${pedido.diasEnEstado} días. ¡Muchas gracias!`
              );
              const telefonoClienteLimpio = (pedido.cliente.telefonoCliente || '').replace(
                /[^0-9]/g,
                ''
              );

              const mensajeDuenaWsp = encodeURIComponent(
                `🚨 Alerta de Cobranza Tutina: El Pedido #${String(pedido.nroPedido).padStart(
                  4,
                  '0'
                )} de ${nombreCompleto} lleva ${
                  pedido.diasEnEstado
                } días pendiente de pago (estado "Entregado y pendiente de pago") por $${pedido.total.toLocaleString(
                  'es-AR'
                )}.`
              );
              const telefonoDuenaLimpio = telefonoDestino.replace(/[^0-9]/g, '');

              return (
                <div
                  key={pedido.nroPedido}
                  className="p-4 rounded-xl border-2 border-rose-300 bg-rose-50/50 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-extrabold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-300">
                            Pedido #{String(pedido.nroPedido).padStart(4, '0')}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-extrabold text-xs">
                            Lleva {pedido.diasEnEstado} días sin abonar
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 mt-1.5">
                          <User className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>{nombreCompleto}</span>
                          <span className="text-xs font-normal text-slate-500">
                            • Tel: {pedido.cliente.telefonoCliente}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Pedido del {new Date(pedido.fechaPedido).toLocaleDateString('es-AR')} •
                          En este estado desde el{' '}
                          {new Date(pedido.fechaInicioEstado).toLocaleDateString('es-AR')}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">
                          Saldo Pendiente
                        </span>
                        <span className="text-lg font-extrabold text-rose-700">
                          ${pedido.total.toLocaleString('es-AR')}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Entregado / En estado desde:{' '}
                        <strong>
                          {new Date(pedido.fechaInicioEstado).toLocaleDateString('es-AR')}
                        </strong>
                      </span>
                      <span>
                        • Fecha pedido:{' '}
                        {new Date(pedido.fechaPedido).toLocaleDateString('es-AR')}
                      </span>
                    </div>

                    {/* Lista de prendas del pedido */}
                    <div className="p-2.5 rounded-lg bg-white border border-rose-200/80 space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <ShoppingBag className="w-3.5 h-3.5 text-rose-600" /> Prendas entregadas en
                        este pedido:
                      </div>
                      <ul className="space-y-1">
                        {pedido.detallesPedido.map((det) => (
                          <li
                            key={det.idDetallePedido}
                            className="text-xs flex items-center justify-between text-slate-700"
                          >
                            <span>
                              <strong>{det.Cantidad}x</strong> {det.variante.producto.nombre}{' '}
                              <span className="text-slate-500">
                                (Talle {det.variante.talle.nombreTalle} •{' '}
                                {det.variante.color.nombreColor})
                              </span>
                            </span>
                            <span className="font-semibold text-slate-900">
                              ${det.subtotal.toLocaleString('es-AR')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Botonera de Acción Rápida */}
                  <div className="pt-2.5 border-t border-rose-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-3">
                      {telefonoClienteLimpio && (
                        <a
                          href={`https://wa.me/${telefonoClienteLimpio}?text=${mensajeClienteWsp}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline"
                        >
                          <PhoneCall className="w-3.5 h-3.5" /> Recordar al Cliente{' '}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <a
                        href={`https://wa.me/${telefonoDuenaLimpio}?text=${mensajeDuenaWsp}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-slate-600 font-semibold hover:text-slate-900 hover:underline"
                      >
                        Notificar Dueña <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="flex items-center gap-2">
                      {codEstadoPagado && (
                        <button
                          type="button"
                          disabled={procesandoPedidoId === pedido.nroPedido}
                          onClick={() => marcarPedidoComoPagado(pedido.nroPedido)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {procesandoPedidoId === pedido.nroPedido
                            ? 'Actualizando...'
                            : 'Marcar Pagado'}
                        </button>
                      )}
                      <Link
                        href="/pedidos"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-100 transition"
                      >
                        Ver Pedido <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Resumen informativo de pedidos en ese estado que aún no cumplieron los 5 días */}
        {pedidosPendientesEnPlazo.length > 0 && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Además hay <strong>{pedidosPendientesEnPlazo.length}</strong>{' '}
              {pedidosPendientesEnPlazo.length === 1 ? 'pedido' : 'pedidos'} en estado
              &ldquo;Entregado y pendiente de pago&rdquo; con menos de {umbralDiasPendientePago}{' '}
              días (en plazo normal):{' '}
              {pedidosPendientesEnPlazo.map((p) => (
                <span
                  key={p.nroPedido}
                  className="inline-flex items-center gap-1 mr-2 font-medium text-slate-700"
                >
                  #{String(p.nroPedido).padStart(4, '0')} ({p.cliente.nombreCliente}{' '}
                  {p.cliente.apellidoCliente} - {p.diasEnEstado}d)
                </span>
              ))}
            </span>
          </div>
        )}
      </div>

      {/* Estado Actual de Variantes con Stock < 3 */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" /> Variantes Actualmente en Nivel
          Crítico (Stock &lt; {umbralGlobal})
        </h2>

        {loading ? (
          <p className="text-xs text-slate-500">Verificando inventario...</p>
        ) : variantesCriticas.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-medium">
            ¡Excelente! Todas las variantes del catálogo de Tutina tienen 3 o más unidades en
            stock.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {variantesCriticas.map((v) => {
              const textoWsp = encodeURIComponent(
                `⚠️ Alerta de Stock en Tutina: La prenda "${v.producto.nombre}" (Talle ${v.talle.nombreTalle}, Color ${v.color.nombreColor}, SKU ${v.sku}) tiene sólo ${v.stock} u. disponibles.`
              );
              const telefonoLimpio = telefonoDestino.replace(/[^0-9]/g, '');

              return (
                <div
                  key={v.codVariante}
                  className="p-4 rounded-xl border border-amber-300 bg-amber-50/60 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[11px] font-bold text-amber-800">
                        {v.sku}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">{v.producto.nombre}</h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Talle: <strong>{v.talle.nombreTalle}</strong> • Color:{' '}
                        <strong>{v.color.nombreColor}</strong>
                      </p>
                      {v.producto.proveedorHabitual && (
                        <p className="text-[11px] text-slate-500 mt-1">
                          Proveedor: {v.producto.proveedorHabitual.nombreProveedor} (
                          {v.producto.proveedorHabitual.numeroProveedor})
                        </p>
                      )}
                    </div>
                    <span className="px-3 py-1 rounded-full bg-rose-600 text-white font-extrabold text-xs shrink-0">
                      Quedan {v.stock} u.
                    </span>
                  </div>

                  <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {v.alertaStockEnviada
                        ? 'Aviso WhatsApp ya disparado (Anti-Spam activo)'
                        : 'Pendiente de disparo'}
                    </span>
                    <a
                      href={`https://wa.me/${telefonoLimpio}?text=${textoWsp}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline"
                    >
                      <PhoneCall className="w-3.5 h-3.5" /> Abrir en WhatsApp Web{' '}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historial de Mensajes Disparados por el Sistema */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <MessageSquareWarning className="w-5 h-5 text-emerald-600" /> Registro de Auditoría de
          Mensajes WhatsApp Enviados a la Dueña
        </h2>

        <div className="space-y-3">
          {alertasLog.map((log) => (
            <div
              key={log.idAlerta}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold">
                    {log.estadoEnvio}
                  </span>
                  <span className="font-mono font-semibold text-slate-700">
                    Destino: {log.telefonoDestino}
                  </span>
                  <span className="text-slate-400">
                    • {new Date(log.fechaDisparo).toLocaleString('es-AR')}
                  </span>
                </div>
                <span className="font-semibold text-amber-800">
                  Origen: {log.origenDisparo} (Stock remanente: {log.stockRemanente} u.)
                </span>
              </div>
              <div className="p-3 rounded-lg bg-white border border-slate-200 text-slate-800 font-medium">
                {log.mensajeEnviado}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
