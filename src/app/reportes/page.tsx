'use client';

import React, { useEffect, useState } from 'react';
import { MobileDataCard } from '@/components/mobile/MobileDataCard';
import {
  TrendingUp,
  DollarSign,
  Award,
  Plus,
  Receipt,
  BarChart3,
  LineChart as LineChartIcon,
  Percent,
  Building,
  Shirt,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  Line,
} from 'recharts';

interface EvolucionItem {
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

interface ProductoRendimiento {
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
  evolucionMensual: EvolucionItem[];
}

interface ReporteData {
  kpis: {
    facturacionBrutaTotal: number;
    descuentosTotales: number;
    facturacionNetaTotal: number;
    cmvHistoricoTotal: number;
    comisionesMediosPagoTotal: number;
    margenContribucionTotal: number;
    margenContribucionPorcentaje: number;
    gastosOperativosTotal: number;
    utilidadNetaTotal: number;
    utilidadNetaPorcentaje: number;
    unidadesVendidasTotal: number;
    cantidadPedidos: number;
  };
  serieMensualGlobal: {
    periodo: string;
    label: string;
    facturacionNeta: number;
    cmv: number;
    comisiones: number;
    margenContribucion: number;
    gastosOperativos: number;
    utilidadNeta: number;
    unidades: number;
  }[];
  rankingProductos: ProductoRendimiento[];
  gastos: {
    idGasto: number;
    descripcionGasto: string;
    montoGasto: number;
    fechaImputacion: string;
    categoriaGasto: { nombreCategoriaGasto: string };
  }[];
  categoriasGasto: { codCategoriaGasto: number; nombreCategoriaGasto: string }[];
}

export default function ReportesFinancierosPage() {
  const [data, setData] = useState<ReporteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [codProdSeleccionado, setCodProdSeleccionado] = useState<number>(1);

  // Selector de Modo de Reporte: 'GENERAL_NEGOCIO' | 'POR_PRENDA' | 'AMBOS'
  const [modoReporte, setModoReporte] = useState<'GENERAL_NEGOCIO' | 'POR_PRENDA' | 'AMBOS'>(
    'GENERAL_NEGOCIO'
  );

  // Formulario de Nuevo Gasto Operativo
  const [mostrarFormGasto, setMostrarFormGasto] = useState(false);
  const [nuevoGasto, setNuevoGasto] = useState({
    descripcionGasto: '',
    montoGasto: 15000,
    fechaImputacion: new Date().toISOString().slice(0, 10),
    codCategoriaGasto: 1,
  });

  const cargarReportes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reportes', { cache: 'no-store' });
      const json: ReporteData = await res.json();
      setData(json);
      if (json.rankingProductos?.[0]) {
        setCodProdSeleccionado(json.rankingProductos[0].codProducto);
      }
      if (json.categoriasGasto?.[0]) {
        setNuevoGasto((prev) => ({
          ...prev,
          codCategoriaGasto: json.categoriasGasto[0].codCategoriaGasto,
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarReportes();
  }, []);

  const handleAgregarGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/reportes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevoGasto),
    });
    if (res.ok) {
      setMostrarFormGasto(false);
      setNuevoGasto({
        ...nuevoGasto,
        descripcionGasto: '',
      });
      await cargarReportes();
    }
  };

  if (loading || !data) {
    return (
      <div className="p-12 text-center text-sm text-slate-500">
        Calculando estados de resultados, Margen de Contribución y Utilidad Neta de Tutina...
      </div>
    );
  }

  const { kpis, serieMensualGlobal, rankingProductos, gastos, categoriasGasto } = data;
  const prendaAnalizada =
    rankingProductos.find((p) => p.codProducto === codProdSeleccionado) || rankingProductos[0];

  const markupPromedioGlobal =
    kpis.cmvHistoricoTotal > 0
      ? Number(((kpis.facturacionNetaTotal / kpis.cmvHistoricoTotal - 1) * 100).toFixed(1))
      : 0;

  return (
    <div className="space-y-6">
      {/* Encabezado y Selector de Nivel de Reporte (General del Negocio vs. Por Prenda) */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 sm:space-y-5">
        <div className="flex flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              Inteligencia Financiera & Rentabilidad
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 sm:mt-1">
              <span className="sm:hidden">Reportes</span>
              <span className="hidden sm:inline">
                Reportes Financieros: Margen de Contribución y Utilidad Neta
              </span>
            </h1>
            <p className="hidden sm:block text-sm text-slate-500">
              Selecciona si deseas analizar el <strong>rendimiento general de todo el negocio</strong>{' '}
              o el <strong>rendimiento histórico por cada prenda</strong>.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMostrarFormGasto(!mostrarFormGasto)}
            className="inline-flex items-center gap-2 px-4 min-h-11 sm:min-h-0 py-2.5 rounded-xl bg-slate-900 text-white text-sm sm:text-xs font-bold hover:bg-rose-600 transition cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="sm:hidden">Gasto</span>
            <span className="hidden sm:inline">Imputar Gasto Operativo</span>
          </button>
        </div>

        {/* Selector Principal de Nivel de Reporte */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-3 sm:pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setModoReporte('GENERAL_NEGOCIO')}
            className={`p-2 sm:p-3.5 min-h-14 sm:min-h-0 rounded-xl border text-center sm:text-left transition cursor-pointer flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-3 ${
              modoReporte === 'GENERAL_NEGOCIO'
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Building
              className={`w-5 h-5 shrink-0 ${
                modoReporte === 'GENERAL_NEGOCIO' ? 'text-white' : 'text-rose-600'
              }`}
            />
            <div>
              <div className="text-xs font-extrabold sm:uppercase sm:tracking-wider">
                <span className="sm:hidden">Negocio</span>
                <span className="hidden sm:inline">1. General de Todo el Negocio</span>
              </div>
              <div
                className={`hidden sm:block text-[11px] ${
                  modoReporte === 'GENERAL_NEGOCIO' ? 'text-rose-100' : 'text-slate-500'
                }`}
              >
                Estado de resultados global, gastos y utilidad neta mensual
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setModoReporte('POR_PRENDA')}
            className={`p-2 sm:p-3.5 min-h-14 sm:min-h-0 rounded-xl border text-center sm:text-left transition cursor-pointer flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-3 ${
              modoReporte === 'POR_PRENDA'
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Shirt
              className={`w-5 h-5 shrink-0 ${
                modoReporte === 'POR_PRENDA' ? 'text-white' : 'text-indigo-600'
              }`}
            />
            <div>
              <div className="text-xs font-extrabold sm:uppercase sm:tracking-wider">
                <span className="sm:hidden">Por prenda</span>
                <span className="hidden sm:inline">2. Rendimiento por Prenda</span>
              </div>
              <div
                className={`hidden sm:block text-[11px] ${
                  modoReporte === 'POR_PRENDA' ? 'text-rose-100' : 'text-slate-500'
                }`}
              >
                Evolución histórica, markup y contribución por indumentaria
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setModoReporte('AMBOS')}
            className={`p-2 sm:p-3.5 min-h-14 sm:min-h-0 rounded-xl border text-center sm:text-left transition cursor-pointer flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-3 ${
              modoReporte === 'AMBOS'
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Layers
              className={`w-5 h-5 shrink-0 ${
                modoReporte === 'AMBOS' ? 'text-white' : 'text-emerald-600'
              }`}
            />
            <div>
              <div className="text-xs font-extrabold sm:uppercase sm:tracking-wider">
                <span className="sm:hidden">Ambos</span>
                <span className="hidden sm:inline">3. Ver Ambos Reportes Juntos</span>
              </div>
              <div
                className={`hidden sm:block text-[11px] ${
                  modoReporte === 'AMBOS' ? 'text-rose-100' : 'text-slate-500'
                }`}
              >
                Vista ejecutiva completa del negocio + detalle por prenda
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Formulario de Gasto Operativo */}
      {mostrarFormGasto && (
        <form
          onSubmit={handleAgregarGasto}
          className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs space-y-4"
        >
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-rose-600" /> Registrar Gasto Operativo / Costo Fijo
            (Impacta en la Utilidad Neta General del Negocio)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              required
              placeholder="Descripción (ej. Bolsas, Expensas, Ads) *"
              value={nuevoGasto.descripcionGasto}
              onChange={(e) =>
                setNuevoGasto({ ...nuevoGasto, descripcionGasto: e.target.value })
              }
              className="sm:col-span-2 px-3 py-2 text-xs rounded-xl border border-slate-200"
            />
            <select
              value={nuevoGasto.codCategoriaGasto}
              onChange={(e) =>
                setNuevoGasto({ ...nuevoGasto, codCategoriaGasto: Number(e.target.value) })
              }
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
            >
              {categoriasGasto.map((cg) => (
                <option key={cg.codCategoriaGasto} value={cg.codCategoriaGasto}>
                  {cg.nombreCategoriaGasto}
                </option>
              ))}
            </select>
            <input
              type="number"
                inputMode="decimal"
              min={1}
              required
              value={nuevoGasto.montoGasto}
              onChange={(e) =>
                setNuevoGasto({ ...nuevoGasto, montoGasto: Number(e.target.value) })
              }
              className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMostrarFormGasto(false)}
              className="px-3 py-1.5 text-xs text-slate-500 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
            >
              Guardar Gasto
            </button>
          </div>
        </form>
      )}

      {/* =========================================================================== */}
      {/* SECCIÓN A: REPORTE FINANCIERO GENERAL DE TODO EL NEGOCIO (TUTINA GLOBAL)   */}
      {/* =========================================================================== */}
      {(modoReporte === 'GENERAL_NEGOCIO' || modoReporte === 'AMBOS') && (
        <div className="space-y-6">
          {/* Tarjetas de KPIs Financieros Globales */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="bg-white p-3 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-start sm:items-center justify-between gap-1 text-[11px] sm:text-xs font-bold uppercase text-slate-400">
                <span><span className="sm:hidden">Facturación</span><span className="hidden sm:inline">Facturación Neta Global</span></span>
                <DollarSign className="w-4 h-4 text-slate-500" />
              </div>
              <div className="text-lg sm:text-2xl font-extrabold text-slate-900">
                ${kpis.facturacionNetaTotal.toLocaleString('es-AR')}
              </div>
              <p className="text-[11px] text-slate-500">
                {kpis.cantidadPedidos} pedidos
                <span className="hidden sm:inline">
                  {' '}• {kpis.unidadesVendidasTotal} prendas • Markup efectivo prom: +
                  {markupPromedioGlobal}%
                </span>
              </p>
            </div>

            <div className="bg-white p-3 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-start sm:items-center justify-between gap-1 text-[11px] sm:text-xs font-bold uppercase text-slate-400">
                <span><span className="sm:hidden">Costos variables</span><span className="hidden sm:inline">Costos Variables (CMV + Pasarela)</span></span>
                <Percent className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-lg sm:text-2xl font-extrabold text-slate-700">
                -${(kpis.cmvHistoricoTotal + kpis.comisionesMediosPagoTotal).toLocaleString('es-AR')}
              </div>
              <p className="hidden sm:block text-[11px] text-slate-500">
                CMV prendas: ${kpis.cmvHistoricoTotal.toLocaleString('es-AR')} | Comisiones: $
                {kpis.comisionesMediosPagoTotal.toLocaleString('es-AR')}
              </p>
            </div>

            <div className="bg-indigo-50/70 p-3 sm:p-5 rounded-2xl border border-indigo-200 shadow-xs space-y-1">
              <div className="flex items-start sm:items-center justify-between gap-1 text-[11px] sm:text-xs font-bold uppercase text-indigo-700">
                <span><span className="sm:hidden">Margen contrib.</span><span className="hidden sm:inline">Margen de Contribución Global</span></span>
                <TrendingUp className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-lg sm:text-2xl font-extrabold text-indigo-950">
                ${kpis.margenContribucionTotal.toLocaleString('es-AR')}
              </div>
              <p className="text-[11px] font-semibold text-indigo-700">
                <span className="sm:hidden">{kpis.margenContribucionPorcentaje}% de las ventas</span>
                <span className="hidden sm:inline">
                  Representa el {kpis.margenContribucionPorcentaje}% sobre las ventas netas del
                  negocio
                </span>
              </p>
            </div>

            <div className="bg-emerald-50/80 p-3 sm:p-5 rounded-2xl border border-emerald-300 shadow-xs space-y-1">
              <div className="flex items-start sm:items-center justify-between gap-1 text-[11px] sm:text-xs font-bold uppercase text-emerald-800">
                <span><span className="sm:hidden">Utilidad neta</span><span className="hidden sm:inline">Utilidad Neta Real del Negocio</span></span>
                <Award className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-lg sm:text-2xl font-extrabold text-emerald-900">
                ${kpis.utilidadNetaTotal.toLocaleString('es-AR')}
              </div>
              <p className="text-[11px] font-semibold text-emerald-800">
                <span className="sm:hidden">{kpis.utilidadNetaPorcentaje}% de rentabilidad</span>
                <span className="hidden sm:inline">
                  Rentabilidad Neta: {kpis.utilidadNetaPorcentaje}% (Gastos fijos: -$
                  {kpis.gastosOperativosTotal.toLocaleString('es-AR')})
                </span>
              </p>
            </div>
          </div>

          {/* Gráfico Global + Estado de Resultados Consolidado del Negocio */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-rose-600 shrink-0" />
                  <span className="sm:hidden">Evolución mensual</span>
                  <span className="hidden sm:inline">
                    Evolución Histórica Mensual de Todo el Negocio (Tutina)
                  </span>
                </h2>
                <p className="hidden sm:block text-xs text-slate-500">
                  Comparativa mes a mes de la Facturación Neta, el Margen de Contribución y la
                  Utilidad Neta Real de la tienda.
                </p>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={serieMensualGlobal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        `$${Number(value).toLocaleString('es-AR')}`,
                        '',
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar
                      dataKey="facturacionNeta"
                      name="Facturación Neta"
                      fill="#94a3b8"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="margenContribucion"
                      name="Margen de Contribución"
                      fill="#6366f1"
                      radius={[6, 6, 0, 0]}
                    />
                    <Line
                      type="monotone"
                      dataKey="utilidadNeta"
                      name="Utilidad Neta Real"
                      stroke="#059669"
                      strokeWidth={3}
                      dot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Cascada del Estado de Resultados General de Tutina */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Estado de Resultados General (EERR)
                </h3>
                <p className="text-xs text-slate-500">
                  Resumen contable consolidado de todo el negocio.
                </p>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Facturación Bruta (Precio Lista)</span>
                  <span className="font-bold text-slate-900">
                    ${kpis.facturacionBrutaTotal.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 text-rose-600">
                  <span>(-) Descuentos Promocionales Otorgados</span>
                  <span className="font-bold">
                    -${kpis.descuentosTotales.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="flex justify-between py-2 bg-slate-50 px-2.5 rounded-lg font-bold text-slate-900">
                  <span>(=) Facturación Neta de Ventas</span>
                  <span>${kpis.facturacionNetaTotal.toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 text-slate-600">
                  <span>(-) Costo de Mercadería Vendida (CMV)</span>
                  <span className="font-semibold">
                    -${kpis.cmvHistoricoTotal.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 text-slate-600">
                  <span>(-) Comisiones por Formas de Pago</span>
                  <span className="font-semibold">
                    -${kpis.comisionesMediosPagoTotal.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="flex justify-between py-2.5 bg-indigo-50 border border-indigo-200 px-3 rounded-xl font-extrabold text-indigo-950">
                  <span>(=) MARGEN DE CONTRIBUCIÓN</span>
                  <span>
                    ${kpis.margenContribucionTotal.toLocaleString('es-AR')} (
                    {kpis.margenContribucionPorcentaje}%)
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 text-rose-600">
                  <span>(-) Gastos Operativos y Costos Fijos</span>
                  <span className="font-bold">
                    -${kpis.gastosOperativosTotal.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="flex justify-between py-3 bg-emerald-50 border border-emerald-300 px-3 rounded-xl font-extrabold text-sm text-emerald-900">
                  <span>(=) UTILIDAD NETA DEL NEGOCIO</span>
                  <span>
                    ${kpis.utilidadNetaTotal.toLocaleString('es-AR')} (
                    {kpis.utilidadNetaPorcentaje}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabla Histórica Mensual de Todo el Negocio */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Desglose Mensual General del Negocio
            </h3>

            {/* Móvil: una tarjeta por mes; el detalle de costos se abre con un toque */}
            <div className="sm:hidden space-y-2.5">
              {serieMensualGlobal.map((m) => (
                <MobileDataCard
                  key={m.periodo}
                  titulo={m.label}
                  subtitulo={`${m.unidades} prendas vendidas`}
                  valor={
                    <span className="text-emerald-700">${m.utilidadNeta.toLocaleString('es-AR')}</span>
                  }
                  valorDetalle="Utilidad neta"
                  tono={m.utilidadNeta < 0 ? 'peligro' : 'normal'}
                  datos={[
                    { label: 'Facturación', valor: `$${m.facturacionNeta.toLocaleString('es-AR')}` },
                    {
                      label: 'Margen contrib.',
                      valor: (
                        <span className="text-indigo-700">
                          ${m.margenContribucion.toLocaleString('es-AR')}
                        </span>
                      ),
                    },
                  ]}
                >
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">CMV histórico</span>
                      <span className="font-semibold">-${m.cmv.toLocaleString('es-AR')}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Comisiones</span>
                      <span className="font-semibold">-${m.comisiones.toLocaleString('es-AR')}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Gastos operativos</span>
                      <span className="font-semibold text-rose-600">
                        -${m.gastosOperativos.toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>
                </MobileDataCard>
              ))}
            </div>

            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Período</th>
                    <th className="py-3 px-3 text-right">Prendas Vendidas</th>
                    <th className="py-3 px-3 text-right">Facturación Neta</th>
                    <th className="py-3 px-3 text-right">CMV Histórico</th>
                    <th className="py-3 px-3 text-right">Comisiones</th>
                    <th className="py-3 px-3 text-right">Margen Contribución</th>
                    <th className="py-3 px-3 text-right">Gastos Operativos</th>
                    <th className="py-3 px-3 text-right">Utilidad Neta Real</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {serieMensualGlobal.map((m) => (
                    <tr key={m.periodo} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-bold text-slate-900">{m.label}</td>
                      <td className="py-3 px-3 text-right font-semibold">{m.unidades} u.</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        ${m.facturacionNeta.toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-500">
                        -${m.cmv.toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-500">
                        -${m.comisiones.toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-indigo-700">
                        ${m.margenContribucion.toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 px-3 text-right text-rose-600">
                        -${m.gastosOperativos.toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-emerald-700">
                        ${m.utilidadNeta.toLocaleString('es-AR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Desglose de Gastos Operativos Imputados */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Gastos Operativos y Costos Fijos Imputados al Negocio
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {gastos.map((g) => (
                <div
                  key={g.idGasto}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-800">{g.descripcionGasto}</div>
                    <div className="text-[11px] text-slate-500">
                      {g.categoriaGasto.nombreCategoriaGasto} •{' '}
                      {new Date(g.fechaImputacion).toLocaleDateString('es-AR')}
                    </div>
                  </div>
                  <span className="font-extrabold text-rose-600">
                    -${g.montoGasto.toLocaleString('es-AR')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================== */}
      {/* SECCIÓN B: REPORTE Y EVOLUCIÓN HISTÓRICA POR PRENDA / INDUMENTARIA          */}
      {/* =========================================================================== */}
      {(modoReporte === 'POR_PRENDA' || modoReporte === 'AMBOS') && (
        <div className="space-y-6">
          <div
            id="grafico-prenda"
            className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5 scroll-mt-20"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <LineChartIcon className="w-5 h-5 text-indigo-600" /> Análisis y Evolución
                  Histórica por Indumentaria Individual
                </h2>
                <p className="text-xs text-slate-500">
                  Elige cualquier prenda del catálogo para visualizar su evolución de Costo vs.
                  Precio de Venta, Markup y Margen de Contribución.
                </p>
              </div>

              <select
                value={codProdSeleccionado}
                onChange={(e) => setCodProdSeleccionado(Number(e.target.value))}
                className="px-3.5 py-2.5 text-xs font-bold rounded-xl border border-indigo-200 bg-indigo-50/50 text-indigo-950"
              >
                {rankingProductos.map((p) => (
                  <option key={p.codProducto} value={p.codProducto}>
                    {p.nombre} (Markup actual: +{p.porcentajeMarkupActual}%)
                  </option>
                ))}
              </select>
            </div>

            {prendaAnalizada && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Costo Vigente / Precio Lista
                    </span>
                    <span className="font-extrabold text-slate-900">
                      ${prendaAnalizada.precioCostoActual.toLocaleString('es-AR')} → $
                      {prendaAnalizada.precioVentaActual.toLocaleString('es-AR')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Markup / Coef. Reventa
                    </span>
                    <span className="font-extrabold text-indigo-700">
                      +{prendaAnalizada.porcentajeMarkupActual}% (
                      {prendaAnalizada.coeficienteReventaActual}x)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Unidades Vendidas / Stock Actual
                    </span>
                    <span className="font-extrabold text-slate-900">
                      {prendaAnalizada.unidadesVendidas} vendidas • {prendaAnalizada.stockTotalActual}{' '}
                      en stock
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Margen de Contribución Aportado
                    </span>
                    <span className="font-extrabold text-emerald-700">
                      +${prendaAnalizada.margenContribucion.toLocaleString('es-AR')} (
                      {prendaAnalizada.margenPorcentajeSobreVenta}% s/venta)
                    </span>
                  </div>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={prendaAnalizada.evolucionMensual}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          `$${Number(value).toLocaleString('es-AR')}`,
                          '',
                        ]}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar
                        dataKey="costoHistoricoPromedio"
                        name="Costo Unitario Histórico"
                        fill="#94a3b8"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="precioVentaPromedio"
                        name="Precio Venta Neto Unit."
                        fill="#e11d48"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="margenContribucion"
                        name="Margen Contribución Total Mes"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>

          {/* Matriz Completa de Rendimiento por Prenda */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                <span className="sm:hidden">Rentabilidad por prenda</span>
                <span className="hidden sm:inline">
                  Matriz Comparativa de Rentabilidad y Coeficiente de Reventa por Indumentaria
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                <span className="sm:hidden">
                  Tocá una prenda para ver el detalle y su gráfico de evolución.
                </span>
                <span className="hidden sm:inline">
                  Haz clic en cualquier fila para ver el gráfico de evolución histórica de esa
                  prenda.
                </span>
              </p>
            </div>

            {/* Móvil: tarjetas con lo esencial (margen y unidades) */}
            <div className="sm:hidden space-y-2.5">
              {rankingProductos.map((p) => (
                <MobileDataCard
                  key={p.codProducto}
                  titulo={p.nombre}
                  subtitulo={`${p.categoria} • ${p.unidadesVendidas} u. vendidas`}
                  valor={
                    <span className="text-emerald-700">
                      +${p.margenContribucion.toLocaleString('es-AR')}
                    </span>
                  }
                  valorDetalle={`${p.margenPorcentajeSobreVenta}% s/ venta`}
                  acciones={
                    <button
                      type="button"
                      onClick={() => {
                        setCodProdSeleccionado(p.codProducto);
                        document
                          .getElementById('grafico-prenda')
                          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="inline-flex min-h-11 items-center gap-2 px-4 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-sm cursor-pointer"
                    >
                      <LineChartIcon className="w-4 h-4" /> Ver gráfico de evolución
                    </button>
                  }
                >
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Costo vigente</span>
                      <span className="font-semibold">
                        ${p.precioCostoActual.toLocaleString('es-AR')}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Markup / coeficiente</span>
                      <span className="font-semibold text-indigo-700">
                        +{p.porcentajeMarkupActual}% ({p.coeficienteReventaActual}x)
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Facturación neta</span>
                      <span className="font-semibold">
                        ${p.facturacionNeta.toLocaleString('es-AR')}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">CMV histórico</span>
                      <span className="font-semibold">
                        -${p.cmvHistorico.toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>
                </MobileDataCard>
              ))}
            </div>

            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Indumentaria</th>
                    <th className="py-3 px-3">Categoría</th>
                    <th className="py-3 px-3 text-right">Costo Vigente</th>
                    <th className="py-3 px-3 text-right">Markup / Coef.</th>
                    <th className="py-3 px-3 text-right">Unid. Vendidas</th>
                    <th className="py-3 px-3 text-right">Facturación Neta</th>
                    <th className="py-3 px-3 text-right">CMV Histórico</th>
                    <th className="py-3 px-3 text-right">Margen Contribución ($)</th>
                    <th className="py-3 px-3 text-right">% Margen s/ Venta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rankingProductos.map((p) => (
                    <tr
                      key={p.codProducto}
                      onClick={() => setCodProdSeleccionado(p.codProducto)}
                      className={`cursor-pointer transition ${
                        p.codProducto === codProdSeleccionado
                          ? 'bg-indigo-50/60'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 px-3 font-bold text-slate-900">{p.nombre}</td>
                      <td className="py-3 px-3 text-slate-600">{p.categoria}</td>
                      <td className="py-3 px-3 text-right font-medium">
                        ${p.precioCostoActual.toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-indigo-700">
                        +{p.porcentajeMarkupActual}% ({p.coeficienteReventaActual}x)
                      </td>
                      <td className="py-3 px-3 text-right font-bold">{p.unidadesVendidas} u.</td>
                      <td className="py-3 px-3 text-right font-semibold">
                        ${p.facturacionNeta.toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-500">
                        -${p.cmvHistorico.toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-emerald-700">
                        +${p.margenContribucion.toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                          {p.margenPorcentajeSobreVenta}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
