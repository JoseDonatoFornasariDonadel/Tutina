// Estructuras grises animadas que se muestran mientras llegan los datos del catálogo.
// Replican las medidas de las tarjetas reales para que la página no "salte" al cargar.

export function SkeletonTarjetaProducto() {
  return (
    <div
      aria-hidden="true"
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col justify-between animate-pulse"
    >
      <div>
        <div className="h-64 bg-slate-200" />
        <div className="p-4 space-y-3">
          <div className="h-3 w-20 rounded bg-slate-200" />
          <div className="h-4 w-3/4 rounded bg-slate-200" />
          <div className="h-3 w-full rounded bg-slate-100" />
          <div className="flex gap-1.5 pt-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-7 w-9 rounded-lg bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 space-y-3">
        <div className="h-6 w-28 rounded bg-slate-200" />
        <div className="h-10 w-full rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

export function SkeletonGrillaProductos({ cantidad = 6 }: { cantidad?: number }) {
  return (
    <div
      role="status"
      aria-label="Cargando prendas"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
    >
      {Array.from({ length: cantidad }).map((_, i) => (
        <SkeletonTarjetaProducto key={i} />
      ))}
    </div>
  );
}

/** Esqueleto de toda la página de la tienda (fallback de Suspense). */
export function TiendaSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <div className="bg-rose-600 h-8" />
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4 animate-pulse">
          <div className="h-9 sm:h-12 w-28 rounded-xl bg-slate-200" />
          <div className="hidden sm:block h-10 flex-1 max-w-md rounded-xl bg-slate-100" />
          <div className="h-10 w-24 rounded-xl bg-slate-200" />
        </div>
      </header>
      <div className="flex-1 w-full px-4 sm:px-6 lg:pl-6 lg:pr-6 py-6 flex flex-col lg:grid lg:grid-cols-[18rem_minmax(0,1fr)_18rem] gap-6 items-start">
        <aside className="hidden lg:block w-72 shrink-0 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs animate-pulse space-y-3">
          <div className="h-4 w-32 rounded bg-slate-200" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-full rounded-lg bg-slate-100" />
          ))}
        </aside>
        <main className="min-w-0 w-full max-w-6xl mx-auto space-y-6">
          <SkeletonGrillaProductos />
        </main>
      </div>
    </div>
  );
}
