import { prisma } from '@/lib/prisma';

export async function obtenerReportesFinancieros() {
  const [pedidos, gastos, productos, categoriasGasto] = await Promise.all([
    prisma.pedido.findMany({
      where: {
        estadoActual: {
          impactaEnReportesVenta: true,
        },
      },
      include: {
        cliente: true,
        estadoActual: true,
        formasPago: {
          include: { formaPago: true },
        },
        detallesPedido: {
          include: {
            variante: {
              include: {
                producto: {
                  include: {
                    categoria: true,
                    marca: true,
                  },
                },
                talle: true,
                color: true,
              },
            },
          },
        },
      },
      orderBy: { fechaPedido: 'asc' },
    }),
    prisma.gastoOperativo.findMany({
      where: { fechaHoraBajaGasto: null },
      include: { categoriaGasto: true },
      orderBy: { fechaImputacion: 'desc' },
    }),
    prisma.producto.findMany({
      where: { fechaHoraBajaProd: null },
      include: {
        categoria: true,
        marca: true,
        historialPrecios: {
          orderBy: { fechaRegistro: 'asc' },
        },
        variantes: {
          where: { fechaHoraBajaVar: null },
        },
      },
    }),
    prisma.categoriaGasto.findMany({
      where: { fechaHoraBajaCG: null },
    }),
  ]);

  let facturacionBrutaTotal = 0;
  let descuentosTotales = 0;
  let facturacionNetaTotal = 0;
  let cmvHistoricoTotal = 0;
  let comisionesMediosPagoTotal = 0;
  let unidadesVendidasTotal = 0;

  // Agrupación mensual (YYYY-MM)
  const mapaMensual = new Map<
    string,
    {
      periodo: string;
      label: string;
      facturacionNeta: number;
      cmv: number;
      comisiones: number;
      margenContribucion: number;
      gastosOperativos: number;
      utilidadNeta: number;
      unidades: number;
    }
  >();

  const nombresMeses = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
  ];

  function obtenerOCrearMes(fecha: Date) {
    const y = fecha.getFullYear();
    const m = fecha.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    if (!mapaMensual.has(key)) {
      mapaMensual.set(key, {
        periodo: key,
        label: `${nombresMeses[m]} ${y}`,
        facturacionNeta: 0,
        cmv: 0,
        comisiones: 0,
        margenContribucion: 0,
        gastosOperativos: 0,
        utilidadNeta: 0,
        unidades: 0,
      });
    }
    return mapaMensual.get(key)!;
  }

  // Rendimiento acumulado e histórico por cada Producto
  const mapaRendimientoProducto = new Map<
    number,
    {
      codProducto: number;
      nombre: string;
      categoria: string;
      marca: string;
      precioCostoActual: number;
      porcentajeMarkupActual: number;
      coeficienteReventaActual: number;
      precioVentaActual: number;
      unidadesVendidas: number;
      facturacionNeta: number;
      cmvHistorico: number;
      margenContribucion: number;
      margenPorcentajeSobreVenta: number;
      markupEfectivoPromedio: number;
      stockTotalActual: number;
      serieMensual: Record<
        string,
        {
          periodo: string;
          label: string;
          unidades: number;
          facturacionNeta: number;
          cmv: number;
          margenContribucion: number;
          precioVentaPromedio: number;
          costoHistoricoPromedio: number;
          markupEfectivoPct: number;
        }
      >;
    }
  >();

  for (const prod of productos) {
    const stockTotal = prod.variantes.reduce((acc, v) => acc + v.stock, 0);
    mapaRendimientoProducto.set(prod.codProducto, {
      codProducto: prod.codProducto,
      nombre: prod.nombre,
      categoria: prod.categoria.nombreCategoria,
      marca: prod.marca.nombreMarca,
      precioCostoActual: prod.precioCosto,
      porcentajeMarkupActual: prod.porcentajeMarkup,
      coeficienteReventaActual: Number((1 + prod.porcentajeMarkup / 100).toFixed(2)),
      precioVentaActual: prod.precio,
      unidadesVendidas: 0,
      facturacionNeta: 0,
      cmvHistorico: 0,
      margenContribucion: 0,
      margenPorcentajeSobreVenta: 0,
      markupEfectivoPromedio: 0,
      stockTotalActual: stockTotal,
      serieMensual: {},
    });
  }

  // Recorrer pedidos válidos
  for (const ped of pedidos) {
    const fecha = new Date(ped.fechaPedido);
    const mesObj = obtenerOCrearMes(fecha);

    facturacionBrutaTotal += ped.subtotalBruto;
    descuentosTotales += ped.montoDescuentosTotal;
    facturacionNetaTotal += ped.total;

    const comisionesPedido = ped.formasPago.reduce(
      (acc, fp) => acc + fp.montoComisionCalculado,
      0
    );
    comisionesMediosPagoTotal += comisionesPedido;

    mesObj.facturacionNeta += ped.total;
    mesObj.comisiones += comisionesPedido;

    for (const det of ped.detallesPedido) {
      const cmvItem = det.Cantidad * det.precioUnitarioCostoHistorico;
      const mcItem = det.subtotal - cmvItem;

      cmvHistoricoTotal += cmvItem;
      unidadesVendidasTotal += det.Cantidad;

      mesObj.cmv += cmvItem;
      mesObj.unidades += det.Cantidad;

      const codProd = det.variante.producto.codProducto;
      const prodStat = mapaRendimientoProducto.get(codProd);
      if (prodStat) {
        prodStat.unidadesVendidas += det.Cantidad;
        prodStat.facturacionNeta += det.subtotal;
        prodStat.cmvHistorico += cmvItem;
        prodStat.margenContribucion += mcItem;

        if (!prodStat.serieMensual[mesObj.periodo]) {
          prodStat.serieMensual[mesObj.periodo] = {
            periodo: mesObj.periodo,
            label: mesObj.label,
            unidades: 0,
            facturacionNeta: 0,
            cmv: 0,
            margenContribucion: 0,
            precioVentaPromedio: 0,
            costoHistoricoPromedio: 0,
            markupEfectivoPct: 0,
          };
        }
        const sm = prodStat.serieMensual[mesObj.periodo];
        sm.unidades += det.Cantidad;
        sm.facturacionNeta += det.subtotal;
        sm.cmv += cmvItem;
        sm.margenContribucion += mcItem;
        sm.precioVentaPromedio = Math.round(sm.facturacionNeta / sm.unidades);
        sm.costoHistoricoPromedio = Math.round(sm.cmv / sm.unidades);
        sm.markupEfectivoPct =
          sm.costoHistoricoPromedio > 0
            ? Number(((sm.precioVentaPromedio / sm.costoHistoricoPromedio - 1) * 100).toFixed(1))
            : 0;
      }
    }
  }

  // Imputar Gastos Operativos por mes
  let gastosOperativosTotal = 0;
  for (const g of gastos) {
    gastosOperativosTotal += g.montoGasto;
    const mesObj = obtenerOCrearMes(new Date(g.fechaImputacion));
    mesObj.gastosOperativos += g.montoGasto;
  }

  // Cerrar cálculos mensuales de Margen de Contribución y Utilidad Neta
  const serieMensualGlobal = Array.from(mapaMensual.values())
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
    .map((m) => {
      const mc = m.facturacionNeta - m.cmv - m.comisiones;
      const un = mc - m.gastosOperativos;
      return {
        ...m,
        margenContribucion: mc,
        utilidadNeta: un,
      };
    });

  const margenContribucionTotal =
    facturacionNetaTotal - cmvHistoricoTotal - comisionesMediosPagoTotal;
  const utilidadNetaTotal = margenContribucionTotal - gastosOperativosTotal;

  const rankingProductos = Array.from(mapaRendimientoProducto.values())
    .map((p) => {
      const margenPct =
        p.facturacionNeta > 0
          ? Number(((p.margenContribucion / p.facturacionNeta) * 100).toFixed(1))
          : 0;
      const markupEfectivo =
        p.cmvHistorico > 0
          ? Number(((p.facturacionNeta / p.cmvHistorico - 1) * 100).toFixed(1))
          : p.porcentajeMarkupActual;

      return {
        ...p,
        margenPorcentajeSobreVenta: margenPct,
        markupEfectivoPromedio: markupEfectivo,
        evolucionMensual: Object.values(p.serieMensual).sort((a, b) =>
          a.periodo.localeCompare(b.periodo)
        ),
      };
    })
    .sort((a, b) => b.margenContribucion - a.margenContribucion);

  return {
    kpis: {
      facturacionBrutaTotal,
      descuentosTotales,
      facturacionNetaTotal,
      cmvHistoricoTotal,
      comisionesMediosPagoTotal,
      margenContribucionTotal,
      margenContribucionPorcentaje:
        facturacionNetaTotal > 0
          ? Number(((margenContribucionTotal / facturacionNetaTotal) * 100).toFixed(1))
          : 0,
      gastosOperativosTotal,
      utilidadNetaTotal,
      utilidadNetaPorcentaje:
        facturacionNetaTotal > 0
          ? Number(((utilidadNetaTotal / facturacionNetaTotal) * 100).toFixed(1))
          : 0,
      unidadesVendidasTotal,
      cantidadPedidos: pedidos.length,
    },
    serieMensualGlobal,
    rankingProductos,
    gastos,
    categoriasGasto,
  };
}
