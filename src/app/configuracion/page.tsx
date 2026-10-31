'use client';

import React, { useEffect, useState } from 'react';
import {
  Image as ImageIcon,
  Save,
  Upload,
  CheckCircle2,
  Phone,
  Sparkles,
  Percent,
  BellRing,
} from 'lucide-react';
import { useAppConfig } from '@/components/layout/AppShell';

export default function ConfiguracionPage() {
  const { config, refreshGlobalState } = useAppConfig();
  const [form, setForm] = useState({
    nombreComercial: 'Tutina',
    logoUrl: '/tutina-logo.svg',
    slogan: 'Indumentaria Deportiva & Urbana',
    telefonoWhatsAppNotificaciones: '+5493516543210',
    whatsappWebhookUrl: '',
    whatsappApiToken: '',
    cuit: '27-34891203-4',
    direccionComercial: 'Av. Hipólito Yrigoyen 450 - Showroom Tutina',
    instagramHandle: '@tutina.indumentaria',
    markupPorDefectoGlobal: 120,
    umbralAlertaStockDefault: 3,
  });
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState(false);

  useEffect(() => {
    if (config) {
      setForm({
        nombreComercial: config.nombreComercial || 'Tutina',
        logoUrl: config.logoUrl || '/tutina-logo.svg',
        slogan: config.slogan || '',
        telefonoWhatsAppNotificaciones: config.telefonoWhatsAppNotificaciones || '',
        whatsappWebhookUrl: config.whatsappWebhookUrl || '',
        whatsappApiToken: config.whatsappApiToken || '',
        cuit: config.cuit || '',
        direccionComercial: config.direccionComercial || '',
        instagramHandle: config.instagramHandle || '',
        markupPorDefectoGlobal: config.markupPorDefectoGlobal ?? 120,
        umbralAlertaStockDefault: config.umbralAlertaStockDefault ?? 3,
      });
    }
  }, [config]);

  // Permite subir un archivo de imagen local desde la computadora de la dueña
  const handleSubirArchivoLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((prev) => ({ ...prev, logoUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

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
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          Identidad Visual & Parámetros del Sistema
        </span>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">
          Configuración Dinámica de &ldquo;{form.nombreComercial}&rdquo;
        </h1>
        <p className="text-sm text-slate-500">
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
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <ImageIcon className="w-5 h-5 text-rose-600" /> Logo Dinámico de la Página
          </h2>

          {/* Previsualización en Vivo */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Vista Previa Actual en Header & Tienda Online
            </span>
            <div className="h-20 flex items-center justify-center px-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.logoUrl || '/tutina-logo.svg'}
                alt="Logo Preview"
                className="max-h-16 w-auto object-contain"
              />
            </div>
          </div>

          {/* Selector de Logos Predefinidos de Tutina */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Estilos Oficiales Predefinidos:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, logoUrl: '/tutina-logo.svg' })}
                className={`p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                  form.logoUrl === '/tutina-logo.svg'
                    ? 'border-rose-500 bg-rose-50 text-rose-800'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                Tutina Active (Rosa/Violeta)
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, logoUrl: '/tutina-logo-alt.svg' })}
                className={`p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                  form.logoUrl === '/tutina-logo-alt.svg'
                    ? 'border-rose-500 bg-rose-50 text-rose-800'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                Tutina Boutique (Dark/Serif)
              </button>
            </div>
          </div>

          {/* Subir Imagen Local desde la PC */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Subir Nuevo Archivo de Logo (PNG, SVG, JPG):
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
              O URL directa de imagen del logo:
            </label>
            <input
              type="text"
              value={form.logoUrl}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200"
            />
          </div>
        </div>

        {/* Columna 2 y 3: Identidad Comercial, Parámetros de Markup y WhatsApp */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Sparkles className="w-5 h-5 text-indigo-600" /> Datos Comerciales, Reglas de Markup y
            WhatsApp
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
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-indigo-800 mb-1 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5" /> Markup Global por Defecto (%)
              </label>
              <input
                type="number"
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
              <label className="block text-xs font-bold text-emerald-800 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Teléfono WhatsApp de la Dueña (Receptora)
              </label>
              <input
                type="text"
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
                placeholder="https://api.whatsapp.com/..."
                value={form.whatsappWebhookUrl}
                onChange={(e) => setForm({ ...form, whatsappWebhookUrl: e.target.value })}
                className="w-full px-3.5 py-2 text-xs font-mono bg-white rounded-xl border border-slate-200"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
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
      </form>
    </div>
  );
}
