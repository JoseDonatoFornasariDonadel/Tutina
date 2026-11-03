import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Devuelve el comprobante adjunto de una factura (PDF o imagen guardados en base64).
// Está bajo /api/proveedores, así que el middleware exige sesión de administración.

const TIPOS_PERMITIDOS = /^(application\/pdf|image\/[a-z0-9.+-]+)$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ idFactura: string }> }
) {
  const { idFactura } = await params;
  const id = Number(idFactura);
  if (!Number.isInteger(id) || id <= 0) {
    return new NextResponse('Comprobante no encontrado', { status: 404 });
  }

  const factura = await prisma.factura.findUnique({
    where: { idFactura: id },
    select: { nroFactura: true, comprobanteUrl: true, rutaFacturaPDF: true },
  });
  const valor = factura?.comprobanteUrl || factura?.rutaFacturaPDF;
  if (!factura || !valor) {
    return new NextResponse('Comprobante no encontrado', { status: 404 });
  }

  if (/^https?:\/\//i.test(valor)) {
    return NextResponse.redirect(valor, 307);
  }

  const match = /^data:([^;,]+)?((?:;[^;,]+)*?)(;base64)?,(.*)$/s.exec(valor);
  const tipo = match?.[1] || '';
  if (!match || !TIPOS_PERMITIDOS.test(tipo)) {
    return new NextResponse('Comprobante no encontrado', { status: 404 });
  }
  const datos = match[3]
    ? Buffer.from(match[4], 'base64')
    : Buffer.from(decodeURIComponent(match[4]), 'utf8');

  const extension = tipo === 'application/pdf' ? 'pdf' : tipo.split('/')[1].replace('+xml', '');
  const nombreArchivo = `Comprobante-${factura.nroFactura}.${extension}`.replace(/[^\w.-]+/g, '_');

  return new NextResponse(new Uint8Array(datos), {
    headers: {
      'Content-Type': tipo,
      'Content-Length': String(datos.length),
      'Content-Disposition': `inline; filename="${nombreArchivo}"`,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      // En imágenes (por ejemplo SVG) evita que el archivo ejecute código. No se aplica a
      // los PDF porque bloquearía el visor del navegador.
      ...(tipo === 'application/pdf'
        ? {}
        : { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" }),
    },
  });
}
