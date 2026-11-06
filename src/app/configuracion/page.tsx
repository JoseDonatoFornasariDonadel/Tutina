'use client';

import React, { useEffect, useState } from 'react';
import {
  Image as ImageIcon,
  Save,
  Upload,
  CheckCircle2,
  Phone,
  Clock,
  Sparkles,
  Percent,
  BellRing,
  Sun,
  Moon,
} from 'lucide-react';
import { useAppConfig } from '@/components/layout/AppShell';
import { comprimirImagen } from '@/lib/comprimirImagen';
import { LOGOS_PREDEFINIDOS, resolverLogos } from '@/lib/logos';

type ModoLogo = 'claro' | 'oscuro';

export default function ConfiguracionPage() {
  const { config, refreshGlobalState } = useAppConfig();
  // Pestaña activa de la tarjeta de logo: define qué logo se edita
  const [modoLogo, setModoLogo] = useState<ModoLogo>('claro');
  const [form, setForm] = useState({
    nombreComercial: 'Tutina',
    logoUrl: '/tutina-logo.svg',
    logoDarkUrl: '',
    slogan: 'Indumentaria Deportiva & Urbana',
    telefonoWhatsAppNotificaciones: '+5493516543210',
    whatsappWebhookUrl: '',
    whatsappApiToken: '',
    cuit: '27-34891203-4',
    direccionComercial: 'Av. Hipólito Yrigoyen 450 - Showroom Tutina',
    instagramHandle: '@tutina.indumentaria',
    markupPorDefectoGlobal: 120,
    umbralAlertaStockDefault: 3,
    diasToleranciaPendientePago: 5,
    alertaPagoContarDesde: 'FECHA_PEDIDO' as 'FECHA_PEDIDO' | 'CAMBIO_ESTADO',
  });
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState(false);

  useEffect(() => {
    if (config) {
      setForm({
        nombreComercial: config.nombreComercial || 'Tutina',
        logoUrl: config.logoUrl || '/tutina-logo.svg',
        logoDarkUrl: config.logoDarkUrl || '',
        slogan: config.slogan || '',
        telefonoWhatsAppNotificaciones: config.telefonoWhatsAppNotificaciones || '',
        whatsappWebhookUrl: config.whatsappWebhookUrl || '',
        whatsappApiToken: config.whatsappApiToken || '',
        cuit: config.cuit || '',
        direccionComercial: config.direccionComercial || '',
        instagramHandle: config.instagramHandle || '',
        markupPorDefectoGlobal: config.markupPorDefectoGlobal ?? 120,
        umbralAlertaStockDefault: config.umbralAlertaStockDefault ?? 3,
        diasToleranciaPendientePago: config.diasToleranciaPendientePago ?? 5,
        alertaPagoContarDesde:
          config.alertaPagoContarDesde === 'CAMBIO_ESTADO' ? 'CAMBIO_ESTADO' : 'FECHA_PEDIDO',
      });
    }
  }, [config]);

  // Permite subir un archivo de imagen local desde la computadora de la dueña
  const handleSubirArchivoLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // El logo se muestra chico: alcanza con 800 px. Las SVG se guardan sin cambios.
    const dataUrl = await comprimirImagen(file, { maxLado: 800, calidad: 0.9 });
    const campo = modoLogo === 'claro' ? 'logoUrl' : 'logoDarkUrl';
    setForm((prev) => ({ ...prev, [campo]: dataUrl }));
    // Permite volver a elegir el mismo archivo para el otro modo
    e.target.value = '';
  };

  // Logo que se edita en la pestaña activa y logos que verá el cliente en cada modo
  const campoLogoActivo = modoLogo === 'claro' ? 'logoUrl' : 'logoDarkUrl';
  const valorLogoActivo = form[campoLogoActivo];
  const logosResueltos = resolverLogos(form.logoUrl, form.logoDarkUrl);
  const logoVistaPrevia = modoLogo === 'claro' ? logosResueltos.claro : logosResueltos.oscuro;
  const logoOscuroAutomatico = modoLogo === 'oscuro' && !form.logoDarkUrl.trim();

  const handleGuardarConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setMensajeExito(false);
    try {
      const res = await fetch('/api/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        await refreshGlobalState();
        setMensajeExito(true);
      }
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          Identidad Visual & Parámetros del Sistema
        </span>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 sm:mt-1">
          <span className="sm:hidden">Configuración</span>
          <span className="hidden sm:inline">
            Configuración Dinámica de &ldquo;{form.nombreComercial}&rdquo;
          </span>
        </h1>
        <p className="sm:hidden text-xs text-slate-500 mt-0.5">
          Logo, datos de la tienda, markup y alertas de WhatsApp.
        </p>
        <p className="hidden sm:block text-sm text-slate-500">
          Personaliza el <strong>logo dinámico de la página</strong>, los datos comerciales de
          Tutina, el número de WhatsApp para alertas de stock crítico y el markup global por
          defecto.
        </p>
      </div>

      {mensajeExito && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ¡Configuración y logo actualizados dinámicamente en todo el sistema!
        </div>
      )}

      <form onSubmit={handleGuardarConfig} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna 1: Cambio Dinámico de Logo */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <ImageIcon className="w-5 h-5 text-rose-600" /> Logo Dinámico de la Página
          </h2>

          {/* Pestañas: logo para modo claro / modo oscuro */}
          <div
            role="tablist"
            aria-label="Modo del logo"
            className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200"
          >
            {(
              [
                { id: 'claro', etiqueta: 'Modo Claro', Icono: Sun },
                { id: 'oscuro', etiqueta: 'Modo Oscuro', Icono: Moon },
              ] as const
            ).map(({ id, etiqueta, Icono }) => {
              const activo = modoLogo === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activo}
                  onClick={() => setModoLogo(id)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold cursor-pointer transition ${
                    activo
                      ? 'bg-white text-rose-700 border border-rose-200 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 border border-transparent'
                  }`}
                >
                  <Icono className="w-3.5 h-3.5" /> {etiqueta}
                </button>
              );
            })}
          </div>

          {/* Previsualización en Vivo: fondo fijo del modo elegido, sin importar el tema del panel */}
          <div
            className={`p-5 rounded-2xl border flex flex-col items-center justify-center space-y-2 ${
              modoLogo === 'claro'
                ? 'bg-[#ffffff] border-[#e2e8f0]'
                : 'bg-[#09090b] border-[#27272a]'
            }`}
          >
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ${
                modoLogo === 'claro' ? 'text-[#94a3b8]' : 'text-[#8b8b94]'
              }`}
            >
              Vista previa • {modoLogo === 'claro' ? 'Modo Claro' : 'Modo Oscuro'}
            </span>
            <div className="h-20 flex items-center justify-center px-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoVistaPrevia}
                alt={`Logo ${modoLogo === 'claro' ? 'modo claro' : 'modo oscuro'}`}
                className="max-h-16 w-auto object-contain"
              />
            </div>
          </div>
          {logoOscuroAutomatico && (
            <p className="text-[11px] text-slate-500 -mt-2">
              No cargaste un logo oscuro: se usa{' '}
              {logosResueltos.oscuro === logosResueltos.claro
                ? 'el mismo logo del modo claro.'
                : 'automáticamente la versión oscura del estilo oficial.'}
            </p>
          )}

          {/* Selector de Logos Predefinidos de Tutina */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Estilos Oficiales Predefinidos ({modoLogo === 'claro' ? 'modo claro' : 'modo oscuro'}):
            </label>
            <div className="grid grid-cols-2 gap-2">
              {LOGOS_PREDEFINIDOS.map((logo) => {
                const url = modoLogo === 'claro' ? logo.claro : logo.oscuro;
                const seleccionado = valorLogoActivo === url;
                return (
                  <button
                    key={logo.id}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, [campoLogoActivo]: url }))}
                    className={`p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                      seleccionado
                        ? 'border-rose-500 bg-rose-50 text-rose-800'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {logo.nombre}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subir Imagen Local desde la PC */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Subir Nuevo Archivo de Logo para {modoLogo === 'claro' ? 'Modo Claro' : 'Modo Oscuro'}{' '}
              (PNG, SVG, JPG):
            </label>
            <label className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-rose-300 bg-rose-50/40 text-xs font-bold text-rose-700 hover:bg-rose-50 cursor-pointer transition">
              <Upload className="w-4 h-4" /> Seleccionar imagen desde mi equipo
              <input
                type="file"
                accept="image/*"
                onChange={handleSubirArchivoLogo}
                className="hidden"
              />
            </label>
          </div>

          {/* O pegar URL externa */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              O URL directa de imagen del logo ({modoLogo === 'claro' ? 'modo claro' : 'modo oscuro'}):
            </label>
            <input
              type="text"
              value={valorLogoActivo}
              placeholder={
                modoLogo === 'oscuro' ? 'Vacío = se elige automáticamente' : '/tutina-logo.svg'
              }
              onChange={(e) => {
                const valor = e.target.value;
                setForm((prev) => ({ ...prev, [campoLogoActivo]: valor }));
              }}
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200"
            />
            {modoLogo === 'oscuro' && form.logoDarkUrl.trim() && (
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, logoDarkUrl: '' }))}
                className="mt-1.5 text-[11px] font-semibold text-slate-500 hover:text-rose-600 cursor-pointer"
              >
                Quitar logo oscuro y usar el automático
              </button>
            )}
          </div>
        </div>

        {/* Columna 2 y 3: Identidad Comercial, Parámetros de Markup y WhatsApp */}
        <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Sparkles className="w-5 h-5 text-indigo-600 shrink-0" />
            <span className="sm:hidden">Datos, markup y WhatsApp</span>
            <span className="hidden sm:inline">Datos Comerciales, Reglas de Markup y WhatsApp</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre Comercial de la Tienda
              </label>
              <input
                type="text"
                required
                value={form.nombreComercial}
                onChange={(e) => setForm({ ...form, nombreComercial: e.target.value })}
                className="w-full px-3.5 py-2 text-sm font-bold rounded-xl border border-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Slogan / Subtítulo de Vidriera
              </label>
              <input
                type="text"
                value={form.slogan}
                onChange={(e) => setForm({ ...form, slogan: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Link o Usuario de Instagram (Redirecciona en la Tienda)
              </label>
              <input
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="https://www.instagram.com/tutina.indumentaria o @usuario"
                value={form.instagramHandle}
                onChange={(e) => setForm({ ...form, instagramHandle: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Podés pegar el link completo de Instagram o escribir <code>@usuario</code>.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dirección Comercial / Link de Google Maps
              </label>
              <input
                type="text"
                placeholder="Ej: Av. Hipólito Yrigoyen 450, Córdoba o link de Google Maps"
                value={form.direccionComercial}
                onChange={(e) => setForm({ ...form, direccionComercial: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Al tocarla en la Tienda, abrirá la ubicación directamente en Google Maps.
              </span>
            </div>
          </div>

          {/* Parámetros de Negocio: Markup Global y Alertas de WhatsApp */}
          <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-indigo-800 mb-1 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5" /> Markup Global por Defecto (%)
              </label>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                value={form.markupPorDefectoGlobal}
                onChange={(e) =>
                  setForm({ ...form, markupPorDefectoGlobal: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2 text-sm font-bold text-indigo-900 bg-white rounded-xl border border-indigo-200"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Se sugiere al dar de alta nuevas prendas.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-800 mb-1 flex items-center gap-1.5">
                <BellRing className="w-3.5 h-3.5" /> Umbral de Alerta de Stock Crítico (Unidades)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={form.umbralAlertaStockDefault}
                onChange={(e) =>
                  setForm({ ...form, umbralAlertaStockDefault: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2 text-sm font-bold text-amber-900 bg-white rounded-xl border border-amber-300"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Dispara WhatsApp cuando <code>stock &lt; {form.umbralAlertaStockDefault}</code>.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-rose-800 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Días de tolerancia de cobro (Entregado y pendiente
                de pago)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={365}
                step={1}
                required
                value={form.diasToleranciaPendientePago}
                onChange={(e) =>
                  setForm({ ...form, diasToleranciaPendientePago: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2 text-sm font-bold text-rose-900 bg-white rounded-xl border border-rose-300"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Alerta cuando un pedido lleva {form.diasToleranciaPendientePago} días o más sin
                cobrarse.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-rose-800 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Contar los días de cobro desde
              </label>
              <select
                value={form.alertaPagoContarDesde}
                onChange={(e) =>
                  setForm({
                    ...form,
                    alertaPagoContarDesde: e.target.value as 'FECHA_PEDIDO' | 'CAMBIO_ESTADO',
                  })
                }
                className="w-full px-3.5 py-2 text-sm font-semibold text-rose-900 bg-white rounded-xl border border-rose-300"
              >
                <option value="FECHA_PEDIDO">La fecha del pedido</option>
                <option value="CAMBIO_ESTADO">
                  El día que pasó a &ldquo;Entregado y pendiente de pago&rdquo;
                </option>
              </select>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {form.alertaPagoContarDesde === 'FECHA_PEDIDO'
                  ? 'Un pedido viejo que pasa hoy a este estado alerta enseguida si ya superó la tolerancia.'
                  : 'El conteo arranca de cero cada vez que el pedido entra en este estado.'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-800 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Teléfono WhatsApp de la Dueña (Receptora)
              </label>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                value={form.telefonoWhatsAppNotificaciones}
                onChange={(e) =>
                  setForm({ ...form, telefonoWhatsAppNotificaciones: e.target.value })
                }
                className="w-full px-3.5 py-2 text-sm font-mono font-bold text-emerald-900 bg-white rounded-xl border border-emerald-300"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Webhook URL WhatsApp API (Opcional: Meta Cloud / Evolution / n8n)
              </label>
              <input
                type="text"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="https://api.whatsapp.com/..."
                value={form.whatsappWebhookUrl}
                onChange={(e) => setForm({ ...form, whatsappWebhookUrl: e.target.value })}
                className="w-full px-3.5 py-2 text-xs font-mono bg-white rounded-xl border border-slate-200"
              />
            </div>
          </div>

          <div className="hidden sm:flex justify-end pt-2">
            <button
              type="submit"
              disabled={guardando}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 transition cursor-pointer shadow-xs"
            >
              <Save className="w-4 h-4" />
              {guardando ? 'Guardando cambios...' : 'Guardar Configuración e Identidad'}
            </button>
          </div>
        </div>

        {/* Celular: el botón queda siempre a mano, encima de la barra inferior */}
        <div className="sm:hidden sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] z-20 -mx-1">
          <button
            type="submit"
            disabled={guardando}
            className="w-full min-h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 text-white text-sm font-bold shadow-lg active:bg-rose-700 disabled:opacity-60 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {guardando ? 'Guardando…' : 'Guardar configuración'}
          </button>
        </div>
      </form>
    </div>
  );
}
