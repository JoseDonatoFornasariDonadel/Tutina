'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { LogoDual } from '@/components/LogoDual';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, User, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const destino = searchParams.get('from') || '/catalogo';

  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Credenciales inválidas.');
        return;
      }

      router.push(destino);
      router.refresh();
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
        {/* Cabecera */}
        <div className="p-6 border-b border-slate-100 text-center space-y-2 bg-rose-50/40">
          <div className="h-14 w-36 mx-auto rounded-xl bg-white border border-slate-200 flex items-center justify-center px-3 py-1.5 shadow-2xs">
            <LogoDual alt="Tutina" className="max-h-10 w-auto object-contain" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold border border-rose-200">
            <ShieldCheck className="w-3.5 h-3.5" /> Acceso Exclusivo de Administración
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">Panel de Gestión • Tutina</h1>
          <p className="text-xs text-slate-500">
            Ingresá tus credenciales de dueña para administrar catálogo, costos, pedidos y reportes
            financieros.
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Usuario Administrador
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input aria-label="Usuario Administrador"
                type="text"
                required
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Ingresá tu usuario"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Contraseña de Gestión
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input aria-label="Contraseña de Gestión"
                type={mostrarPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-rose-500"
              />
              <button
                type="button"
                onClick={() => setMostrarPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {mostrarPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Verificando acceso...' : 'Ingresar al Panel de Gestión'}
          </button>
        </form>

        {/* Pie con regreso a la tienda pública */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">¿Sos cliente y querés ver las prendas?</span>
          <Link
            href="/tienda"
            className="inline-flex items-center gap-1 font-bold text-rose-600 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Ir al Catálogo Público
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">
          Cargando acceso de seguridad...
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
