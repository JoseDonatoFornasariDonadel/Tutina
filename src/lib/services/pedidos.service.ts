import { prisma } from '@/lib/prisma';
import {
  calcularPrecioNetoConDescuento,
  obtenerPorcentajeDescuentoVigente,
} from './pricing.service';
import {
  DisparoAlertaResultado,
  evaluarReseteoAlertaStock,
  evaluarYDispararAlertaStock,
} from './whatsapp.service';

export interface ItemPedidoInput {
  codVariante: number;
  cantidad: number;
}

export interface CrearPedidoInput {
  fechaPedido?: string;
  codCliente: number;
  codEstadoActual?: number;
  codFP: number;
  canalVenta?: string;
  observaciones?: string;
  montoPagadoInicial?: number;
  items: ItemPedidoInput[];
}

export async function registrarNuevoPedido(input: CrearPedidoInput) {
  if (!input.items || input.items.length === 0) {
    throw new Error('El pedido debe contener al menos un producto seleccionado.');
  }

  return await prisma.$transaction(async (tx) => {
    const fechaPedido = input.fechaPedido ? new Date(input.fechaPedido) : new Date();

    // 1. Validar Estado Inicial y Forma de Pago
    const estadoInicial = input.codEstadoActual
      ? await tx.estadoPedido.findUnique({ where: { codEP: input.codEstadoActual } })
      : await tx.estadoPedido.findFirst({ where: { reservaStock: true, fechaHoraBajaEP: null } });

    if (!estadoInicial) {
      throw new Error('No se encontró un Estado de Pedido válido.');
    }

    const formaPago = await tx.formaPago.findUnique({
      where: { codFP: input.codFP },
    });

    if (!formaPago) {
      throw new Error('No se encontró la Forma de Pago seleccionada.');
    }

    let subtotalBruto = 0;
    let totalNeto = 0;

    const detallesParaCrear: {
      codVariante: number;
      Cantidad: number;
      precioUnitarioVenta: number;
      porcentajeDescuentoAplicado: number;
      precioUnitarioNeto: number;
      precioUnitarioCostoHistorico: number;
      subtotal: number;
    }[] = [];

    const alertasWhatsAppDisparadas: DisparoAlertaResultado[] = [];

    // 2. Procesar cada ítem, validar y descontar stock, y congelar Snapshot Histórico
    for (const item of input.items) {
      const variante = await tx.varianteProducto.findUnique({
        where: { codVariante: item.codVariante },
        include: {
          producto: {
            include: { descuento: true },
          },
          talle: true,
          color: true,
        },
      });

      if (!variante || variante.fechaHoraBajaVar) {
        throw new Error(`La variante #${item.codVariante} no existe o está dada de baja.`);
      }

      if (estadoInicial.reservaStock && variante.stock < item.cantidad) {
        throw new Error(
          `Stock insuficiente para "${variante.producto.nombre}" (${variante.talle.nombreTalle} - ${variante.color.nombreColor}). Stock disponible: ${variante.stock}, solicitado: ${item.cantidad}.`
        );
      }

      const precioLista = variante.producto.precio;
      const pctDescuento = obtenerPorcentajeDescuentoVigente(variante.producto.descuento, fechaPedido);
      const precioNetoUnit = calcularPrecioNetoConDescuento(precioLista, pctDescuento);
      const costoHistoricoUnit = variante.producto.precioCosto;

      const brutoItem = precioLista * item.cantidad;
      const subtotalItem = precioNetoUnit * item.cantidad;

      subtotalBruto += brutoItem;
      totalNeto += subtotalItem;

      detallesParaCrear.push({
        codVariante: variante.codVariante,
        Cantidad: item.cantidad,
        precioUnitarioVenta: precioLista,
        porcentajeDescuentoAplicado: pctDescuento,
        precioUnitarioNeto: precioNetoUnit,
        precioUnitarioCostoHistorico: costoHistoricoUnit,
        subtotal: subtotalItem,
      });

      if (estadoInicial.reservaStock) {
        await tx.varianteProducto.update({
          where: { codVariante: variante.codVariante },
          data: { stock: { decrement: item.cantidad } },
        });

        const resultadoAlerta = await evaluarYDispararAlertaStock(
          tx,
          variante.codVariante,
          'VENTA_PEDIDO'
        );
        if (resultadoAlerta.disparada) {
          alertasWhatsAppDisparadas.push(resultadoAlerta);
        }
      }
    }

    const esPendientePago = estadoInicial.nombreEP
      .toLowerCase()
      .includes('entregado y pendiente de pago');

    let totalPagadoInicial = esPendientePago ? 0 : totalNeto;
    if (input.montoPagadoInicial !== undefined && input.montoPagadoInicial !== null) {
      totalPagadoInicial = Math.min(totalNeto, Math.max(0, Number(input.montoPagadoInicial)));
    }
    const totalAPagarInicial = Math.max(0, totalNeto - totalPagadoInicial);

    const montoPagoRegistrado = totalPagadoInicial > 0 ? totalPagadoInicial : totalNeto;
    const montoComision = Math.round(
      montoPagoRegistrado * (formaPago.porcentajeComisionActual / 100)
    );

    // 3. Crear Pedido con DetallePedido, PedidoEstado y PedidoFormaPago
    const nuevoPedido = await tx.pedido.create({
      data: {
        fechaPedido,
        canalVenta: input.canalVenta || 'LOCAL_MANUAL',
        subtotalBruto,
        montoDescuentosTotal: subtotalBruto - totalNeto,
        total: totalNeto,
        totalPagado: totalPagadoInicial,
        totalAPagar: totalAPagarInicial,
        observaciones: input.observaciones || null,
        codCliente: input.codCliente,
        codEstadoActual: estadoInicial.codEP,
        detallesPedido: {
          create: detallesParaCrear,
        },
        historialEstados: {
          create: [
            {
              codEP: estadoInicial.codEP,
              fechaInicioPE: fechaPedido,
              motivoCambio: 'Alta de pedido en sistema',
            },
          ],
        },
        formasPago:
          totalPagadoInicial > 0
            ? {
                create: [
                  {
                    codFP: formaPago.codFP,
                    montoPFP: totalPagadoInicial,
                    fechaPFP: fechaPedido,
                    porcentajeComisionAplicado: formaPago.porcentajeComisionActual,
                    montoComisionCalculado: montoComision,
                    comprobanteReferencia:
                      totalAPagarInicial > 0 ? 'Entrega parcial inicial' : 'Pago total del pedido',
                  },
                ],
              }
            : undefined,
      },
      include: {
        cliente: true,
        estadoActual: true,
        detallesPedido: {
          include: {
            variante: {
              include: { producto: true, talle: true, color: true },
            },
          },
        },
        formasPago: {
          include: { formaPago: true },
        },
      },
    });

    return {
      pedido: nuevoPedido,
      alertasWhatsAppDisparadas,
    };
  });
}

export async function registrarEntregaParcialPedido(input: {
  nroPedido: number;
  montoEntrega: number;
  codFP?: number;
  comprobanteReferencia?: string;
}) {
  const monto = Number(input.montoEntrega);
  if (!monto || monto <= 0) {
    throw new Error('El monto de la entrega debe ser mayor a $0.');
  }

  return await prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({
      where: { nroPedido: Number(input.nroPedido) },
      include: {
        estadoActual: true,
        formasPago: true,
      },
    });

    if (!pedido) {
      throw new Error(`Pedido #${input.nroPedido} no encontrado.`);
    }

    const saldoActual =
      pedido.totalAPagar > 0
        ? pedido.totalAPagar
        : Math.max(0, pedido.total - pedido.totalPagado);

    if (saldoActual <= 0) {
      throw new Error('Este pedido ya se encuentra 100% abonado.');
    }

    const montoAplicado = Math.min(saldoActual, monto);
    const nuevoTotalPagado = Math.min(pedido.total, pedido.totalPagado + montoAplicado);
    const nuevoTotalAPagar = Math.max(0, pedido.total - nuevoTotalPagado);

    const formaPago = input.codFP
      ? await tx.formaPago.findUnique({ where: { codFP: Number(input.codFP) } })
      : await tx.formaPago.findFirst({ where: { fechaHoraBajaFP: null } });

    if (!formaPago) {
      throw new Error('No se encontró una Forma de Pago válida.');
    }

    const comisionCalculada = Math.round(
      montoAplicado * (formaPago.porcentajeComisionActual / 100)
    );

    await tx.pedidoFormaPago.create({
      data: {
        nroPedido: pedido.nroPedido,
        codFP: formaPago.codFP,
        montoPFP: montoAplicado,
        fechaPFP: new Date(),
        porcentajeComisionAplicado: formaPago.porcentajeComisionActual,
        montoComisionCalculado: comisionCalculada,
        comprobanteReferencia:
          input.comprobanteReferencia?.trim() ||
          (nuevoTotalAPagar === 0
            ? 'Cancelación de saldo restante'
            : `Entrega parcial ($${montoAplicado.toLocaleString('es-AR')})`),
      },
    });

    let nuevoCodEstado = pedido.codEstadoActual;

    // Si con esta entrega parcial terminó de pagar todo el pedido, pasa automáticamente a Pagado y Entregado
    if (nuevoTotalAPagar === 0) {
      const estadoPagado = await tx.estadoPedido.findFirst({
        where: {
          fechaHoraBajaEP: null,
          nombreEP: { contains: 'Pagado' },
        },
      });

      if (estadoPagado && estadoPagado.codEP !== pedido.codEstadoActual) {
        nuevoCodEstado = estadoPagado.codEP;

        await tx.pedidoEstado.updateMany({
          where: { nroPedido: pedido.nroPedido, fechaFinPE: null },
          data: { fechaFinPE: new Date() },
        });

        await tx.pedidoEstado.create({
          data: {
            nroPedido: pedido.nroPedido,
            codEP: estadoPagado.codEP,
            fechaInicioPE: new Date(),
            motivoCambio: `Pago completado con entrega de $${montoAplicado.toLocaleString(
              'es-AR'
            )} (Total pagado: $${nuevoTotalPagado.toLocaleString('es-AR')})`,
          },
        });
      }
    }

    return await tx.pedido.update({
      where: { nroPedido: pedido.nroPedido },
      data: {
        totalPagado: nuevoTotalPagado,
        totalAPagar: nuevoTotalAPagar,
        codEstadoActual: nuevoCodEstado,
      },
      include: {
        cliente: true,
        estadoActual: true,
        formasPago: { include: { formaPago: true } },
        historialEstados: {
          include: { estadoPedido: true },
          orderBy: { fechaInicioPE: 'desc' },
        },
      },
    });
  });
}

export async function cambiarEstadoPedido(
  nroPedido: number,
  nuevoCodEP: number,
  motivoCambio?: string
) {
  return await prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({
      where: { nroPedido },
      include: {
        estadoActual: true,
        detallesPedido: true,
      },
    });

    if (!pedido) {
      throw new Error(`Pedido #${nroPedido} no encontrado.`);
    }

    const nuevoEstado = await tx.estadoPedido.findUnique({
      where: { codEP: nuevoCodEP },
    });

    if (!nuevoEstado) {
      throw new Error('El nuevo estado seleccionado no existe.');
    }

    if (pedido.codEstadoActual === nuevoCodEP) {
      return pedido;
    }

    // Cerrar el estado vigente en PedidoEstado
    await tx.pedidoEstado.updateMany({
      where: {
        nroPedido,
        fechaFinPE: null,
      },
      data: {
        fechaFinPE: new Date(),
      },
    });

    // Abrir el nuevo registro en PedidoEstado
    await tx.pedidoEstado.create({
      data: {
        nroPedido,
        codEP: nuevoCodEP,
        fechaInicioPE: new Date(),
        motivoCambio: motivoCambio || `Cambio a ${nuevoEstado.nombreEP}`,
      },
    });

    // Si pasa de un estado que reservaba stock a un estado que libera stock (ej. de "Entregado y pendiente de pago" a "Cancelado / Devuelto")
    if (pedido.estadoActual.reservaStock && nuevoEstado.liberaStock) {
      for (const det of pedido.detallesPedido) {
        await tx.varianteProducto.update({
          where: { codVariante: det.codVariante },
          data: { stock: { increment: det.Cantidad } },
        });
        await evaluarReseteoAlertaStock(tx, det.codVariante);
      }
    } else if (!pedido.estadoActual.reservaStock && nuevoEstado.reservaStock) {
      // Si se reactiva un pedido devuelto/cancelado, vuelve a descontar stock
      for (const det of pedido.detallesPedido) {
        await tx.varianteProducto.update({
          where: { codVariante: det.codVariante },
          data: { stock: { decrement: det.Cantidad } },
        });
        await evaluarYDispararAlertaStock(tx, det.codVariante, 'CAMBIO_ESTADO_PEDIDO');
      }
    }

    const nombreNuevoLower = nuevoEstado.nombreEP.toLowerCase();
    let nuevoTotalPagado = pedido.totalPagado;
    let nuevoTotalAPagar = pedido.totalAPagar;

    if (nombreNuevoLower.includes('pagado') && !nombreNuevoLower.includes('pendiente')) {
      nuevoTotalPagado = pedido.total;
      nuevoTotalAPagar = 0;
    } else if (nombreNuevoLower.includes('entregado y pendiente de pago')) {
      if (nuevoTotalPagado >= pedido.total) {
        nuevoTotalPagado = 0;
      }
      nuevoTotalAPagar = Math.max(0, pedido.total - nuevoTotalPagado);
    } else if (nuevoEstado.liberaStock) {
      nuevoTotalAPagar = 0;
    }

    // Actualizar EstadoActual y saldos en Pedido
    return await tx.pedido.update({
      where: { nroPedido },
      data: {
        codEstadoActual: nuevoCodEP,
        totalPagado: nuevoTotalPagado,
        totalAPagar: nuevoTotalAPagar,
      },
      include: {
        cliente: true,
        estadoActual: true,
        historialEstados: {
          include: { estadoPedido: true },
          orderBy: { fechaInicioPE: 'desc' },
        },
      },
    });
  });
}
