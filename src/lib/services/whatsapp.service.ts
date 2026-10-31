import { Prisma } from '@prisma/client';

export interface DisparoAlertaResultado {
  disparada: boolean;
  mensaje?: string;
  telefonoDestino?: string;
  sku?: string;
  nombreProducto?: string;
  stockRemanente?: number;
}

/**
 * Regla Crítica RN-04:
 * Cuando el stock de una variante baja a menos de 3 unidades (stock < umbral)
 * y aún no se ha enviado la alerta (alertaStockEnviada == false),
 * dispara el aviso por WhatsApp a la dueña de Tutina y marca alertaStockEnviada = true.
 */
export async function evaluarYDispararAlertaStock(
  tx: Prisma.TransactionClient,
  codVariante: number,
  origenDisparo: string = 'VENTA_PEDIDO'
): Promise<DisparoAlertaResultado> {
  const config = await tx.configuracionTienda.findFirst();
  const umbralGlobal = config?.umbralAlertaStockDefault ?? 3;
  const telefonoDuena = config?.telefonoWhatsAppNotificaciones ?? '+5493516543210';
  const nombreTienda = config?.nombreComercial ?? 'Tutina';

  const variante = await tx.varianteProducto.findUnique({
    where: { codVariante },
    include: {
      producto: true,
      talle: true,
      color: true,
    },
  });

  if (!variante || variante.fechaHoraBajaVar) {
    return { disparada: false };
  }

  const umbralEfectivo = variante.umbralStockPropio || umbralGlobal;

  if (variante.stock < umbralEfectivo && !variante.alertaStockEnviada) {
    const mensaje = `⚠️ *Alerta de Stock en ${nombreTienda}*: La prenda *${variante.producto.nombre}* (Talle: ${variante.talle.nombreTalle}, Color: ${variante.color.nombreColor}, SKU: ${variante.sku}) quedó con *${variante.stock} ${
      variante.stock === 1 ? 'unidad' : 'unidades'
    }* disponibles (umbral crítico < ${umbralEfectivo}).`;

    let estadoEnvio = 'ENVIADO_SIMULADO';

    // Si hay un Webhook de WhatsApp configurado (Meta Cloud API / CallMeBot / n8n / Evolution API), se invoca:
    if (config?.whatsappWebhookUrl && config.whatsappWebhookUrl.startsWith('http')) {
      try {
        const res = await fetch(config.whatsappWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(config.whatsappApiToken ? { Authorization: `Bearer ${config.whatsappApiToken}` } : {}),
          },
          body: JSON.stringify({
            to: telefonoDuena,
            message: mensaje,
            sku: variante.sku,
            stock: variante.stock,
          }),
        });
        estadoEnvio = res.ok ? 'ENVIADO_WEBHOOK' : 'ENVIADO_LOCAL_FALLBACK';
      } catch {
        estadoEnvio = 'ENVIADO_LOCAL_FALLBACK';
      }
    } else {
      estadoEnvio = 'ENVIADO';
    }

    await tx.alertaWhatsAppLog.create({
      data: {
        codVariante: variante.codVariante,
        telefonoDestino: telefonoDuena,
        mensajeEnviado: mensaje,
        stockRemanente: variante.stock,
        estadoEnvio,
        origenDisparo,
        leidaEnPanel: false,
      },
    });

    await tx.varianteProducto.update({
      where: { codVariante: variante.codVariante },
      data: { alertaStockEnviada: true },
    });

    return {
      disparada: true,
      mensaje,
      telefonoDestino: telefonoDuena,
      sku: variante.sku,
      nombreProducto: `${variante.producto.nombre} (${variante.talle.nombreTalle} - ${variante.color.nombreColor})`,
      stockRemanente: variante.stock,
    };
  }

  return { disparada: false };
}

/**
 * Resetea el flag alertaStockEnviada a false cuando el stock vuelve a ser >= umbral (por defecto 3),
 * ya sea por ingreso de nueva Factura de Proveedor o por cancelación/devolución de un Pedido.
 */
export async function evaluarReseteoAlertaStock(
  tx: Prisma.TransactionClient,
  codVariante: number
): Promise<boolean> {
  const config = await tx.configuracionTienda.findFirst();
  const umbralGlobal = config?.umbralAlertaStockDefault ?? 3;

  const variante = await tx.varianteProducto.findUnique({
    where: { codVariante },
  });

  if (!variante) return false;

  const umbralEfectivo = variante.umbralStockPropio || umbralGlobal;

  if (variante.stock >= umbralEfectivo && variante.alertaStockEnviada) {
    await tx.varianteProducto.update({
      where: { codVariante },
      data: { alertaStockEnviada: false },
    });
    return true;
  }

  return false;
}
