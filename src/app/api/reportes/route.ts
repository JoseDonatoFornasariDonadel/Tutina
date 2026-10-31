import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { obtenerReportesFinancieros } from '@/lib/services/reportes.service';

export async function GET() {
  const data = await obtenerReportesFinancieros();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { descripcionGasto, montoGasto, fechaImputacion, codCategoriaGasto } = body;

    if (!descripcionGasto || !montoGasto || !codCategoriaGasto) {
      return NextResponse.json(
        { error: 'Descripción, monto y categoría de gasto son obligatorios.' },
        { status: 400 }
      );
    }

    const nuevoGasto = await prisma.gastoOperativo.create({
      data: {
        descripcionGasto,
        montoGasto: Number(montoGasto),
        fechaImputacion: fechaImputacion ? new Date(fechaImputacion) : new Date(),
        codCategoriaGasto: Number(codCategoriaGasto),
      },
      include: { categoriaGasto: true },
    });

    return NextResponse.json(nuevoGasto);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al registrar gasto operativo';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
