'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Truck,
  FileText,
  Plus,
  CheckCircle2,
  Building2,
  Globe,
  Phone,
  Mail,
  Trash2,
  ArrowUpRight,
  Search,
  UserPlus,
  Edit3,
} from 'lucide-react';
import { useAppConfig } from '@/components/layout/AppShell';

interface Proveedor {
  codProveedor: number;
  nombreProveedor: string;
  webProveedor?: string | null;
  numeroProveedor: string;
  correoProveedor?: string | null;
  facturas?: { idFactura: number }[];
  productosHabituales?: { codProducto: number; nombre: string }[];
}

interface VarianteIngreso {
  codVariante: number;
  sku: string;
  stock: number;
  producto: {
    codProducto: number;
    nombre: string;
    precioCosto: number;
    porcentajeMarkup: number;
    precio: number;
  };
  talle: { nombreTalle: string };
  color: { nombreColor: string };
}

interface FacturaHist {
  idFactura: number;
  nroFactura: string;
  fechaFactura: string;
  ivaFactura: number;
  costoTotal: number;
  rutaFacturaPDF?: string | null;
  proveedor: { nombreProveedor: string };
  detallesIngreso: {
    idDetalleIngreso: number;
    cantidadDI: number;
    precioIndividual: number;
    subtotalDI: number;
    variante: {
      sku: string;
      producto: { nombre: string };
      talle: { nombreTalle: string };
      color: { nombreColor: string };
    };
  }[];
}

export default function ProveedoresFacturasPage() {
  const { refreshGlobalState } = useAppConfig();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [facturas, setFacturas] = useState<FacturaHist[]>([]);
  const [variantes, setVariantes] = useState<VarianteIngreso[]>([]);
  const [loading, setLoading] = useState(true);

  // Selector de Apartado: 'PROVEEDORES' | 'FACTURAS' | 'AMBOS'
  const [vistaActiva, setVistaActiva] = useState<'AMBOS' | 'PROVEEDORES' | 'FACTURAS'>('AMBOS');

  // Estado del Apartado de Registro de Proveedores
  const [busquedaProv, setBusquedaProv] = useState('');
  const [nuevoProvForm, setNuevoProvForm] = useState({
    nombreProveedor: '',
    numeroProveedor: '+54911',
    correoProveedor: '',
    webProveedor: '',
  });
  const [guardandoProv, setGuardandoProv] = useState(false);
  const [mensajeExitoProv, setMensajeExitoProv] = useState<string | null>(null);
  const [proveedorEditando, setProveedorEditando] = useState<Proveedor | null>(null);

  // Formulario de Nueva Factura / DetalleIngreso
  const [codProveedorSel, setCodProveedorSel] = useState<number>(0);
  const [nroFactura, setNroFactura] = useState('FC-A-0001-00004890');
  const [ivaFactura, setIvaFactura] = useState(21);
  const [rutaFacturaPDF, setRutaFacturaPDF] = useState('/facturas/comprobante-proveedor.pdf');
  const [lineasIngreso, setLineasIngreso] = useState<
    { codVariante: number; cantidadDI: number; precioIndividual: number }[]
  >([]);
  const [guardandoFactura, setGuardandoFactura] = useState(false);

  // Resumen de impacto tras cargar factura
  const [resultadoImpacto, setResultadoImpacto] = useState<
    | {
        nombre: string;
        costoAnterior: number;
        costoNuevo: number;
        precioVentaAnterior: number;
        precioVentaNuevo: number;
        alertaReseteada: boolean;
      }[]
    | null
  >(null);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/proveedores', { cache: 'no-store' });
      const data = await res.json();
      setProveedores(data.proveedores || []);
      setFacturas(data.facturas || []);
      setVariantes(data.variantes || []);
      if (data.proveedores?.[0] && !codProveedorSel) {
        setCodProveedorSel(data.proveedores[0].codProveedor);
      }
      if (data.variantes?.[0] && lineasIngreso.length === 0) {
        setLineasIngreso([
          {
            codVariante: data.variantes[0].codVariante,
            cantidadDI: 6,
            precioIndividual: data.variantes[0].producto.precioCosto,
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const proveedoresFiltrados = useMemo(() => {
    const q = busquedaProv.trim().toLowerCase();
    if (!q) return proveedores;
    return proveedores.filter(
      (p) =>
        p.nombreProveedor.toLowerCase().includes(q) ||
        p.numeroProveedor.toLowerCase().includes(q) ||
        (p.correoProveedor && p.correoProveedor.toLowerCase().includes(q))
    );
  }, [proveedores, busquedaProv]);

  const handleCrearProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardandoProv(true);
    setMensajeExitoProv(null);
    try {
      const res = await fetch('/api/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'PROVEEDOR',
          ...nuevoProvForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar proveedor');

      setMensajeExitoProv(
        `¡Proveedor "${data.nombreProveedor}" registrado en el sistema y disponible para asociar a prendas y facturas!`
      );
      setNuevoProvForm({
        nombreProveedor: '',
        numeroProveedor: '+54911',
        correoProveedor: '',
        webProveedor: '',
      });
      setCodProveedorSel(data.codProveedor);
      await cargarDatos();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al registrar proveedor');
    } finally {
      setGuardandoProv(false);
    }
  };

  const handleGuardarEdicionProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proveedorEditando) return;
    const res = await fetch('/api/proveedores', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proveedorEditando),
    });
    if (res.ok) {
      setMensajeExitoProv(`Datos de "${proveedorEditando.nombreProveedor}" actualizados.`);
      setProveedorEditando(null);
      await cargarDatos();
    }
  };

  const handleDarBajaProveedor = async (codProveedor: number, nombre: string) => {
    if (!confirm(`¿Dar de baja lógica al proveedor "${nombre}"?`)) return;
    const res = await fetch(`/api/proveedores?codProveedor=${codProveedor}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      await cargarDatos();
    }
  };

  const agregarLineaIngreso = () => {
    if (!variantes[0]) return;
    setLineasIngreso([
      ...lineasIngreso,
      {
        codVariante: variantes[0].codVariante,
        cantidadDI: 5,
        precioIndividual: variantes[0].producto.precioCosto,
      },
    ]);
  };

  const handleRegistrarFactura = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lineasIngreso.length === 0) return;
    setGuardandoFactura(true);
    try {
      const res = await fetch('/api/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codProveedor: codProveedorSel,
          nroFactura,
          ivaFactura,
          rutaFacturaPDF,
          detalles: lineasIngreso,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar factura');

      setResultadoImpacto(data.productosActualizados || []);
      setNroFactura(`FC-A-0001-0000${Math.floor(5000 + Math.random() * 4000)}`);
      await cargarDatos();
      await refreshGlobalState();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al registrar factura');
    } finally {
      setGuardandoFactura(false);
    }
  };

  const costoTotalFactura = lineasIngreso.reduce(
    (acc, l) => acc + l.cantidadDI * l.precioIndividual,
    0
  );

  return (
    <div className="space-y-6">
      {/* Encabezado y Selector de Apartados */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Abastecimiento, Directorio de Proveedores & Facturas
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Gestión de Proveedores e Ingreso de Mercadería
          </h1>
          <p className="text-sm text-slate-500">
            Registra nuevos proveedores en el sistema, administra sus datos de contacto y carga sus
            facturas para actualizar stock y costos automáticamente.
          </p>
        </div>

        {/* Selector de Apartado */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 shrink-0 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setVistaActiva('AMBOS')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              vistaActiva === 'AMBOS'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Vista Completa
          </button>
          <button
            type="button"
            onClick={() => setVistaActiva('PROVEEDORES')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              vistaActiva === 'PROVEEDORES'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🏢 Registro de Proveedores ({proveedores.length})
          </button>
          <button
            type="button"
            onClick={() => setVistaActiva('FACTURAS')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              vistaActiva === 'FACTURAS'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📄 Carga de Facturas ({facturas.length})
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* APARTADO 1: REGISTRO Y DIRECTORIO DE PROVEEDORES                  */}
      {/* ================================================================= */}
      {(vistaActiva === 'AMBOS' || vistaActiva === 'PROVEEDORES') && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-rose-600" /> Apartado de Registro de Proveedores
              </h2>
              <p className="text-xs text-slate-500">
                Da de alta a los proveedores mayoristas o fabricantes que aún no están en el
                sistema.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busquedaProv}
                onChange={(e) => setBusquedaProv(e.target.value)}
                placeholder="Buscar proveedor registrado..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200"
              />
            </div>
          </div>

          {mensajeExitoProv && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {mensajeExitoProv}
              </span>
              <button
                onClick={() => setMensajeExitoProv(null)}
                className="underline ml-3 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          )}

          {/* Formulario permanente para Registrar Nuevo Proveedor */}
          <form
            onSubmit={handleCrearProveedor}
            className="p-5 rounded-2xl bg-rose-50/50 border border-rose-200/80 space-y-4"
          >
            <div className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Registrar Nuevo Proveedor en Tutina
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Nombre / Razón Social *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Textil Deportiva Norte S.A."
                  value={nuevoProvForm.nombreProveedor}
                  onChange={(e) =>
                    setNuevoProvForm({ ...nuevoProvForm, nombreProveedor: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Teléfono / WhatsApp (`numeroProveedor`) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="+54911..."
                  value={nuevoProvForm.numeroProveedor}
                  onChange={(e) =>
                    setNuevoProvForm({ ...nuevoProvForm, numeroProveedor: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Correo Electrónico (`correoProveedor`)
                </label>
                <input
                  type="email"
                  placeholder="ventas@proveedor.com.ar"
                  value={nuevoProvForm.correoProveedor}
                  onChange={(e) =>
                    setNuevoProvForm({ ...nuevoProvForm, correoProveedor: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Sitio Web / Catálogo (`webProveedor`)
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={nuevoProvForm.webProveedor}
                  onChange={(e) =>
                    setNuevoProvForm({ ...nuevoProvForm, webProveedor: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={guardandoProv}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition cursor-pointer shadow-2xs"
              >
                <UserPlus className="w-4 h-4" />
                {guardandoProv ? 'Registrando...' : 'Guardar Nuevo Proveedor'}
              </button>
            </div>
          </form>

          {/* Modal / Formulario de Edición de Proveedor Existente */}
          {proveedorEditando && (
            <form
              onSubmit={handleGuardarEdicionProveedor}
              className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-3"
            >
              <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                <span>Editando Proveedor #{proveedorEditando.codProveedor}</span>
                <button
                  type="button"
                  onClick={() => setProveedorEditando(null)}
                  className="text-slate-500 underline cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  value={proveedorEditando.nombreProveedor}
                  onChange={(e) =>
                    setProveedorEditando({
                      ...proveedorEditando,
                      nombreProveedor: e.target.value,
                    })
                  }
                  className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                />
                <input
                  type="text"
                  required
                  value={proveedorEditando.numeroProveedor}
                  onChange={(e) =>
                    setProveedorEditando({
                      ...proveedorEditando,
                      numeroProveedor: e.target.value,
                    })
                  }
                  className="px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 bg-white"
                />
                <input
                  type="email"
                  placeholder="Correo"
                  value={proveedorEditando.correoProveedor || ''}
                  onChange={(e) =>
                    setProveedorEditando({
                      ...proveedorEditando,
                      correoProveedor: e.target.value,
                    })
                  }
                  className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                />
                <input
                  type="text"
                  placeholder="Web"
                  value={proveedorEditando.webProveedor || ''}
                  onChange={(e) =>
                    setProveedorEditando({
                      ...proveedorEditando,
                      webProveedor: e.target.value,
                    })
                  }
                  className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                >
                  Actualizar Proveedor
                </button>
              </div>
            </form>
          )}

          {/* Grilla de Proveedores Registrados */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-600" /> Directorio de Proveedores Activos (
              {proveedoresFiltrados.length})
            </h3>

            {loading ? (
              <p className="text-xs text-slate-400">Cargando proveedores...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {proveedoresFiltrados.map((pr) => (
                  <div
                    key={pr.codProveedor}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-slate-900 text-sm">
                          {pr.nombreProveedor}
                        </div>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-200/70 text-slate-600">
                          ID #{pr.codProveedor}
                        </span>
                      </div>

                      <div className="text-slate-600 flex items-center gap-1.5 font-mono text-[11px]">
                        <Phone className="w-3.5 h-3.5 text-emerald-600" /> {pr.numeroProveedor}
                      </div>

                      {pr.correoProveedor && (
                        <div className="text-slate-500 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" /> {pr.correoProveedor}
                        </div>
                      )}

                      {pr.webProveedor && (
                        <a
                          href={pr.webProveedor}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:underline flex items-center gap-1 text-[11px] font-medium"
                        >
                          <Globe className="w-3 h-3" /> {pr.webProveedor}{' '}
                          <ArrowUpRight className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">
                        {pr.facturas?.length || 0} facturas •{' '}
                        {pr.productosHabituales?.length || 0} prendas
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setProveedorEditando(pr)}
                          className="text-indigo-600 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDarBajaProveedor(pr.codProveedor, pr.nombreProveedor)}
                          className="text-rose-600 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Baja
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* APARTADO 2: CARGA DE FACTURAS Y DETALLE DE INGRESO                */}
      {/* ================================================================= */}
      {(vistaActiva === 'AMBOS' || vistaActiva === 'FACTURAS') && (
        <>
          {resultadoImpacto && (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-300 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ¡Factura e Ingreso de Mercadería registrados! Impacto en Catálogo:
                </div>
                <button
                  onClick={() => setResultadoImpacto(null)}
                  className="text-xs font-semibold text-emerald-800 underline cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {resultadoImpacto.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white p-3 rounded-xl border border-emerald-200 text-xs space-y-1"
                  >
                    <div className="font-bold text-slate-900">{item.nombre}</div>
                    <div className="text-slate-600">
                      Costo Unitario: ${item.costoAnterior.toLocaleString('es-AR')} →{' '}
                      <strong className="text-slate-900">
                        ${item.costoNuevo.toLocaleString('es-AR')}
                      </strong>
                    </div>
                    <div className="text-slate-600">
                      Precio Venta Sugerido: ${item.precioVentaAnterior.toLocaleString('es-AR')} →{' '}
                      <strong className="text-emerald-700">
                        ${item.precioVentaNuevo.toLocaleString('es-AR')}
                      </strong>
                    </div>
                    {item.alertaReseteada && (
                      <div className="text-[11px] font-bold text-indigo-700">
                        ✓ Stock recuperado (&gt;= 3 u.): Flag alertaStockEnviada reseteado.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <form
            onSubmit={handleRegistrarFactura}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5"
          >
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText className="w-5 h-5 text-rose-600" /> Cargar Nueva Factura de Proveedor (
              `Factura` + `DetalleIngreso`)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Proveedor Emisor
                </label>
                <select
                  value={codProveedorSel}
                  onChange={(e) => setCodProveedorSel(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium"
                >
                  {proveedores.map((p) => (
                    <option key={p.codProveedor} value={p.codProveedor}>
                      {p.nombreProveedor} ({p.numeroProveedor})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nro. Factura
                </label>
                <input
                  type="text"
                  required
                  value={nroFactura}
                  onChange={(e) => setNroFactura(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">IVA (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={ivaFactura}
                  onChange={(e) => setIvaFactura(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>
            </div>

            {/* Líneas de DetalleIngreso */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Ítems de Mercadería Ingresada (`DetalleIngreso`)
                </label>
                <button
                  type="button"
                  onClick={agregarLineaIngreso}
                  className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar renglón
                </button>
              </div>

              <div className="space-y-2.5">
                {lineasIngreso.map((linea, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                  >
                    <div className="sm:col-span-6">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Variante de Prenda (Talle / Color)
                      </label>
                      <select
                        value={linea.codVariante}
                        onChange={(e) => {
                          const codV = Number(e.target.value);
                          const vObj = variantes.find((v) => v.codVariante === codV);
                          const copia = [...lineasIngreso];
                          copia[idx] = {
                            ...linea,
                            codVariante: codV,
                            precioIndividual: vObj?.producto.precioCosto ?? linea.precioIndividual,
                          };
                          setLineasIngreso(copia);
                        }}
                        className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                      >
                        {variantes.map((v) => (
                          <option key={v.codVariante} value={v.codVariante}>
                            {v.producto.nombre} | Talle {v.talle.nombreTalle} - {v.color.nombreColor}{' '}
                            (Stock actual: {v.stock})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Cantidad (`cantidadDI`)
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={linea.cantidadDI}
                        onChange={(e) => {
                          const copia = [...lineasIngreso];
                          copia[idx] = { ...linea, cantidadDI: Number(e.target.value) };
                          setLineasIngreso(copia);
                        }}
                        className="w-full px-2.5 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-white"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Costo Unit. (`precioIndividual`)
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={linea.precioIndividual}
                        onChange={(e) => {
                          const copia = [...lineasIngreso];
                          copia[idx] = { ...linea, precioIndividual: Number(e.target.value) };
                          setLineasIngreso(copia);
                        }}
                        className="w-full px-2.5 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-white"
                      />
                    </div>

                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        disabled={lineasIngreso.length <= 1}
                        onClick={() => setLineasIngreso(lineasIngreso.filter((_, i) => i !== idx))}
                        className="p-2 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-sm font-bold text-slate-800">
                Costo Total Factura:{' '}
                <span className="text-lg font-extrabold text-rose-600">
                  ${costoTotalFactura.toLocaleString('es-AR')}
                </span>
              </div>
              <button
                type="submit"
                disabled={guardandoFactura}
                className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
              >
                {guardandoFactura
                  ? 'Procesando Ingreso...'
                  : 'Registrar Factura, Sumar Stock y Actualizar Costos'}
              </button>
            </div>
          </form>

          {/* Historial de Facturas Registradas */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-slate-700" /> Historial de Facturas e Ingresos de
              Stock
            </h2>
            <div className="space-y-3">
              {facturas.map((f) => (
                <div
                  key={f.idFactura}
                  className="p-4 rounded-xl border border-slate-200 space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold bg-slate-900 text-white px-2.5 py-1 rounded-lg">
                        {f.nroFactura}
                      </span>
                      <span className="font-bold text-slate-800">
                        {f.proveedor.nombreProveedor}
                      </span>
                      <span className="text-slate-400">
                        • {new Date(f.fechaFactura).toLocaleDateString('es-AR')}
                      </span>
                    </div>
                    <span className="font-extrabold text-sm text-slate-900">
                      Costo Total: ${f.costoTotal.toLocaleString('es-AR')} (IVA {f.ivaFactura}%)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {f.detallesIngreso.map((di) => (
                      <span
                        key={di.idDetalleIngreso}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700"
                      >
                        +{di.cantidadDI} u. de <strong>{di.variante.producto.nombre}</strong> (
                        {di.variante.talle.nombreTalle}) a $
                        {di.precioIndividual.toLocaleString('es-AR')} c/u
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
