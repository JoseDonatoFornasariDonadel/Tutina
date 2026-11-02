import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

export async function GET() {
  let config = await prisma.configuracionTienda.findFirst();
  if (!config) {
    config = await prisma.configuracionTienda.create({
      data: {
        nombreComercial: 'Tutina',
        logoUrl: '/tutina-logo.svg',
        slogan: 'Indumentaria Deportiva & Urbana',
        telefonoWhatsAppNotificaciones: '+5493516543210',
        markupPorDefectoGlobal: 120.0,
        umbralAlertaStockDefault: 3,
      },
    });
  }
  return NextResponse.json(config);
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const existente = await prisma.configuracionTienda.findFirst();

    const data = {
      nombreComercial: body.nombreComercial ?? 'Tutina',
      logoUrl: body.logoUrl || '/tutina-logo.svg',
      slogan: body.slogan ?? 'Indumentaria Deportiva & Urbana',
      telefonoWhatsAppNotificaciones: body.telefonoWhatsAppNotificaciones ?? '+5493516543210',
      whatsappWebhookUrl: body.whatsappWebhookUrl || null,
      whatsappApiToken: body.whatsappApiToken || null,
      cuit: body.cuit || null,
      direccionComercial: body.direccionComercial || null,
      instagramHandle: body.instagramHandle || null,
      markupPorDefectoGlobal: Number(body.markupPorDefectoGlobal ?? 120),
      umbralAlertaStockDefault: Number(body.umbralAlertaStockDefault ?? 3),
      diasToleranciaPendientePago: Math.min(
        365,
        Math.max(0, Math.round(Number(body.diasToleranciaPendientePago ?? 5)) || 0)
      ),
      alertaPagoContarDesde:
        body.alertaPagoContarDesde === 'CAMBIO_ESTADO' ? 'CAMBIO_ESTADO' : 'FECHA_PEDIDO',
      fechaUltimaModificacion: new Date(),
    };

    const actualizado = existente
      ? await prisma.configuracionTienda.update({
          where: { idConfiguracion: existente.idConfiguracion },
          data,
        })
      : await prisma.configuracionTienda.create({ data });

    revalidatePath('/tienda');
    return NextResponse.json(actualizado);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al actualizar configuración';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
