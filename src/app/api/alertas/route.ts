import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// Rendimiento: todas las consultas usan `select` con solo los campos que muestra la
// página. Antes se traían las prendas completas, incluida la foto en base64 (varios MB
// por prenda), en el historial de alertas, el stock crítico y el detalle de cada pedido.

const NOMBRE_ESTADO_PENDIENTE_PAGO = 'Entregado y pendiente de pago';

const selectVarianteCritica = {
  codVariante: true,
  sku: true,
  stock: true,
  alertaStockEnviada: true,
  producto: {
    select: {
      nombre: true,
      marca: { select: { nombreMarca: true } },
      proveedorHabitual: { select: { nombreProveedor: true, numeroProveedor: true } },
    },
  },
  talle: { select: { nombreTalle: true } },
  color: { select: { nombreColor: true, codigoHex: true } },
} satisfies Prisma.VarianteProductoSelect;

const selectAlertaLog = {
  idAlerta: true,
  fechaDisparo: true,
  telefonoDestino: true,
  mensajeEnviado: true,
  stockRemanente: true,
  estadoEnvio: true,
  origenDisparo: true,
  variante: {
    select: {
      sku: true,
      producto: { select: { nombre: true } },
      talle: { select: { nombreTalle: true } },
      color: { select: { nombreColor: true } },
    },
  },
} satisfies Prisma.AlertaWhatsAppLogSelect;

async function obtenerEstadoPendientePago() {
  // Asegurar que exista el estado "Entregado y pendiente de pago"
  const existente = await prisma.estadoPedido.findFirst({
    where: { nombreEP: NOMBRE_ESTADO_PENDIENTE_PAGO, fechaHoraBajaEP: null },
  });
  if (existente) return existente;
  return prisma.estadoPedido.create({
    data: {
      nombreEP: NOMBRE_ESTADO_PENDIENTE_PAGO,
      colorBadge: 'amber',
      reservaStock: true,
      liberaStock: false,
      impactaEnReportesVenta: true,
    },
  });
}

/**
 * Pedidos en "Entregado y pendiente de pago" con saldo, ya evaluados contra la tolerancia.
 * La base filtra por estado y descarta los pedidos totalmente pagados (totalPagado < total);
 * el cálculo de días y saldo es el mismo de siempre y se aplica igual a cada pedido.
 */
async function obtenerPedidosPendientes(
  codEP: number,
  diasTolerancia: number,
  contarDesde: 'FECHA_PEDIDO' | 'CAMBIO_ESTADO',
  incluirDetalle: boolean
) {
  const pedidosEnPendientePago = await prisma.pedido.findMany({
    where: {
      codEstadoActual: codEP,
      // Pre-filtro en la base: solo pedidos que todavía deben algo. Es más amplio que el
      // filtro final (saldoPendiente > 0), que se sigue aplicando abajo.
      totalPagado: { lt: prisma.pedido.fields.total },
    },
    select: {
      nroPedido: true,
      fechaPedido: true,
      codEstadoActual: true,
      total: true,
      totalPagado: true,
      observaciones: true,
      // Solo los registros de historial del estado actual: son los únicos que se usan
      historialEstados: {
        where: { codEP },
        select: { codEP: true, fechaInicioPE: true, fechaFinPE: true },
        orderBy: { fechaInicioPE: 'desc' },
      },
      ...(incluirDetalle
        ? {
            cliente: {
              select: {
                codCliente: true,
                nombreCliente: true,
                apellidoCliente: true,
                telefonoCliente: true,
                emailCliente: true,
              },
            },
            estadoActual: { select: { codEP: true, nombreEP: true } },
            detallesPedido: {
              select: {
                idDetallePedido: true,
                Cantidad: true,
                subtotal: true,
                variante: {
                  select: {
                    sku: true,
                    producto: {
                      select: { nombre: true, marca: { select: { nombreMarca: true } } },
                    },
                    talle: { select: { nombreTalle: true } },
                    color: { select: { nombreColor: true } },
                  },
                },
              },
            },
          }
        : {}),
    },
    orderBy: { fechaPedido: 'asc' },
  });

  const ahora = new Date();
  const msPorDia = 1000 * 60 * 60 * 24;

  // La alerta se reevalúa en cada consulta (no se guarda ningún flag), así que un pedido
  // viejo que recién pasa a "Entregado y pendiente de pago" se evalúa igual que el resto.
  const pedidosConAntiguedad = pedidosEnPendientePago.map((pedido) => {
    const fechaPedidoDate = new Date(pedido.fechaPedido);

    // Fecha en la que entró al estado actual: el registro de historial abierto más reciente
    // de ese estado. Si el pedido no tiene historial, se usa la fecha del pedido.
    const registrosDelEstado = pedido.historialEstados
      .filter((h) => h.codEP === pedido.codEstadoActual)
      .sort((a, b) => new Date(b.fechaInicioPE).getTime() - new Date(a.fechaInicioPE).getTime());
    const estadoVigente =
      registrosDelEstado.find((h) => h.fechaFinPE === null) || registrosDelEstado[0];
    const fechaInicioEstado = estadoVigente
      ? new Date(estadoVigente.fechaInicioPE)
      : fechaPedidoDate;

    const fechaReferencia = contarDesde === 'FECHA_PEDIDO' ? fechaPedidoDate : fechaInicioEstado;

    const diasEnEstado = Math.max(
      0,
      Math.floor((ahora.getTime() - fechaReferencia.getTime()) / msPorDia)
    );

    // Saldo real: total del pedido menos lo que ya se pagó (pagos iniciales y entregas parciales).
    // Se usa totalPagado porque es el acumulado que mantienen todos los registros de pago.
    const totalPagado = Math.min(pedido.total, Math.max(0, pedido.totalPagado ?? 0));
    const saldoPendiente = Math.round((pedido.total - totalPagado) * 100) / 100;

    return {
      nroPedido: pedido.nroPedido,
      fechaPedido: pedido.fechaPedido,
      fechaInicioEstado: fechaInicioEstado.toISOString(),
      fechaReferencia: fechaReferencia.toISOString(),
      diasEnEstado,
      total: pedido.total,
      totalPagado,
      saldoPendiente,
      observaciones: pedido.observaciones,
      ...(incluirDetalle
        ? {
            cliente: pedido.cliente,
            estadoActual: pedido.estadoActual,
            detallesPedido: pedido.detallesPedido,
          }
        : {}),
    };
  });

  // Filtrar los que superan los días de tolerancia configurados
  // Un pedido sin saldo pendiente no tiene nada que cobrar, así que no genera alerta
  const pedidosConSaldo = pedidosConAntiguedad.filter((p) => p.saldoPendiente > 0);

  const pedidosPendientesVencidos = pedidosConSaldo
    .filter((p) => p.diasEnEstado >= diasTolerancia)
    .sort((a, b) => b.diasEnEstado - a.diasEnEstado);

  const pedidosPendientesEnPlazo = pedidosConSaldo
    .filter((p) => p.diasEnEstado < diasTolerancia)
    .sort((a, b) => b.diasEnEstado - a.diasEnEstado);

  return { pedidosPendientesVencidos, pedidosPendientesEnPlazo };
}

export async function GET(request: Request) {
  // ?resumen=1 → solo los contadores (lo usa el menú lateral en cada cambio de página)
  const soloResumen = new URL(request.url).searchParams.get('resumen') === '1';

  const [config, estadoEntregadoPendiente] = await Promise.all([
    prisma.configuracionTienda.findFirst(),
    obtenerEstadoPendientePago(),
  ]);
  const umbralGlobal = config?.umbralAlertaStockDefault ?? 3;
  const diasTolerancia = config?.diasToleranciaPendientePago ?? 5;
  const contarDesde =
    config?.alertaPagoContarDesde === 'CAMBIO_ESTADO' ? 'CAMBIO_ESTADO' : 'FECHA_PEDIDO';

  const filtroStockCritico = {
    fechaHoraBajaVar: null,
    stock: { lt: umbralGlobal },
  } satisfies Prisma.VarianteProductoWhereInput;

  if (soloResumen) {
    const [cantidadVariantesCriticas, pedidos] = await Promise.all([
      prisma.varianteProducto.count({ where: filtroStockCritico }),
      obtenerPedidosPendientes(estadoEntregadoPendiente.codEP, diasTolerancia, contarDesde, false),
    ]);
    return NextResponse.json({
      cantidadVariantesCriticas,
      cantidadPedidosPendientesVencidos: pedidos.pedidosPendientesVencidos.length,
      umbralGlobal,
      umbralDiasPendientePago: diasTolerancia,
    });
  }

  const [alertasLog, variantesCriticas, pedidos, estadosActivos] = await Promise.all([
    prisma.alertaWhatsAppLog.findMany({
      select: selectAlertaLog,
      orderBy: { fechaDisparo: 'desc' },
      take: 50,
    }),
    prisma.varianteProducto.findMany({
      where: filtroStockCritico,
      select: selectVarianteCritica,
      orderBy: { stock: 'asc' },
    }),
    obtenerPedidosPendientes(estadoEntregadoPendiente.codEP, diasTolerancia, contarDesde, true),
    prisma.estadoPedido.findMany({
      where: { fechaHoraBajaEP: null },
      select: { codEP: true, nombreEP: true },
    }),
  ]);
  const { pedidosPendientesVencidos, pedidosPendientesEnPlazo } = pedidos;

  const estadoPagado = estadosActivos.find(
    (e) =>
      e.nombreEP.toLowerCase().includes('pagado') &&
      !e.nombreEP.toLowerCase().includes('pendiente')
  );

  return NextResponse.json({
    alertasLog,
    variantesCriticas,
    pedidosPendientesVencidos,
    pedidosPendientesEnPlazo,
    umbralDiasPendientePago: diasTolerancia,
    alertaPagoContarDesde: contarDesde,
    codEstadoPagado: estadoPagado?.codEP ?? null,
    umbralGlobal,
    telefonoDestino: config?.telefonoWhatsAppNotificaciones ?? '+5493516543210',
  });
}

export async function PATCH() {
  await prisma.alertaWhatsAppLog.updateMany({
    where: { leidaEnPanel: false },
    data: { leidaEnPanel: true },
  });
  return NextResponse.json({ ok: true });
}
