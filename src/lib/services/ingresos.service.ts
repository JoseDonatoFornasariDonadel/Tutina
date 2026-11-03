import { prisma } from '@/lib/prisma';
import { calcularPrecioSugerido } from './pricing.service';
import { evaluarReseteoAlertaStock } from './whatsapp.service';

export interface DetalleIngresoInput {
  codVariante: number;
  cantidadDI: number;
  precioIndividual: number;
}

export interface RegistrarFacturaInput {
  codProveedor: number;
  nroFactura: string;
  fechaFactura?: string;
  ivaFactura?: number;
  rutaFacturaPDF?: string;
  comprobanteUrl?: string | null;
  detalles: DetalleIngresoInput[];
}

/**
 * RN-03: Registra una Factura de Proveedor y sus DetalleIngreso:
 * 1. Incrementa el stock de cada VarianteProducto.
 * 2. Si el stock nuevo es >= 3, resetea alertaStockEnviada = false.
 * 3. Actualiza automáticamente el precioCosto del Producto al último costo ingresado (Reposición)
 *    y recalcula el precio de venta sugerido manteniendo su porcentajeMarkup.
 */
export async function registrarFacturaIngreso(input: RegistrarFacturaInput) {
  if (!input.detalles || input.detalles.length === 0) {
    throw new Error('La factura debe incluir al menos un ítem en el detalle de ingreso.');
  }

  return await prisma.$transaction(async (tx) => {
    let costoTotalCalculado = 0;

    const detallesConSubtotal = input.detalles.map((d) => {
      const sub = Math.round(d.cantidadDI * d.precioIndividual);
      costoTotalCalculado += sub;
      return {
        codVariante: d.codVariante,
        cantidadDI: d.cantidadDI,
        precioIndividual: d.precioIndividual,
        subtotalDI: sub,
      };
    });

    const comprobanteFinal = input.comprobanteUrl || input.rutaFacturaPDF || null;

    const factura = await tx.factura.create({
      data: {
        nroFactura: input.nroFactura,
        fechaFactura: input.fechaFactura ? new Date(input.fechaFactura) : new Date(),
        ivaFactura: input.ivaFactura ?? 21.0,
        rutaFacturaPDF: comprobanteFinal,
        comprobanteUrl: comprobanteFinal,
        costoTotal: costoTotalCalculado,
        codProveedor: input.codProveedor,
        detallesIngreso: {
          create: detallesConSubtotal,
        },
      },
      include: {
        proveedor: true,
        detallesIngreso: {
          include: {
            variante: {
              include: { producto: true, talle: true, color: true },
            },
          },
        },
      },
    });

    const productosActualizados: {
      codProducto: number;
      nombre: string;
      costoAnterior: number;
      costoNuevo: number;
      precioVentaAnterior: number;
      precioVentaNuevo: number;
      alertaReseteada: boolean;
    }[] = [];

    for (const item of input.detalles) {
      const variante = await tx.varianteProducto.update({
        where: { codVariante: item.codVariante },
        data: { stock: { increment: item.cantidadDI } },
        include: { producto: true },
      });

      const alertaReseteada = await evaluarReseteoAlertaStock(tx, item.codVariante);

      const prod = variante.producto;
      const nuevoPrecioVenta = calcularPrecioSugerido(item.precioIndividual, prod.porcentajeMarkup);

      await tx.producto.update({
        where: { codProducto: prod.codProducto },
        data: {
          precioCosto: item.precioIndividual,
          precio: nuevoPrecioVenta,
          codProveedorHabitual: input.codProveedor,
        },
      });

      await tx.historialPrecioProducto.create({
        data: {
          codProducto: prod.codProducto,
          precioCosto: item.precioIndividual,
          porcentajeMarkup: prod.porcentajeMarkup,
          precioVenta: nuevoPrecioVenta,
          motivo: `Ingreso Factura ${input.nroFactura}`,
        },
      });

      productosActualizados.push({
        codProducto: prod.codProducto,
        nombre: prod.nombre,
        costoAnterior: prod.precioCosto,
        costoNuevo: item.precioIndividual,
        precioVentaAnterior: prod.precio,
        precioVentaNuevo: nuevoPrecioVenta,
        alertaReseteada,
      });
    }

    return {
      factura,
      productosActualizados,
    };
  });
}
