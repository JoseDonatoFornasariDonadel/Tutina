'use client';

import { SelectorCreable } from '@/components/catalogo/SelectorCreable';

export interface CategoriaOpcion {
  codCategoria: number;
  nombreCategoria: string;
  rubro?: string;
  markupPorDefectoCategoria?: number;
}

/** Guarda una categoría nueva (o reutiliza la existente con ese nombre) y la devuelve. */
export async function crearCategoria(nombreCategoria: string): Promise<CategoriaOpcion> {
  const res = await fetch('/api/catalogo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipoAlta: 'CATEGORIA', nombreCategoria }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'No se pudo crear la categoría');
  return data as CategoriaOpcion;
}

/** Agrega la categoría a una lista sin duplicarla y la deja ordenada por nombre. */
export function agregarCategoria<T extends CategoriaOpcion>(lista: T[], nueva: T): T[] {
  const sinDuplicar = lista.some((c) => c.codCategoria === nueva.codCategoria)
    ? lista.map((c) => (c.codCategoria === nueva.codCategoria ? { ...c, ...nueva } : c))
    : [...lista, nueva];
  return sinDuplicar.sort((a, b) => a.nombreCategoria.localeCompare(b.nombreCategoria, 'es'));
}

interface CategoriaSelectorProps {
  categorias: CategoriaOpcion[];
  value: number | null | undefined;
  onChange: (categoria: CategoriaOpcion) => void;
  /** Avisa al formulario o pantalla para sumar la categoría nueva a sus listas y filtros. */
  onCategoriaCreada?: (categoria: CategoriaOpcion) => void;
  className?: string;
  id?: string;
}

/** Selector de categoría con buscador y alta en línea ("Crear: ..."). */
export function CategoriaSelector({
  categorias,
  value,
  onChange,
  onCategoriaCreada,
  className,
  id,
}: CategoriaSelectorProps) {
  return (
    <SelectorCreable
      id={id}
      className={className}
      entidad="categoría"
      placeholder="Elegir categoría..."
      placeholderBusqueda="Buscar o crear categoría..."
      opciones={categorias.map((c) => ({ id: c.codCategoria, nombre: c.nombreCategoria }))}
      value={value}
      onChange={(opcion) => {
        const cat = categorias.find((c) => c.codCategoria === opcion.id);
        if (cat) onChange(cat);
      }}
      onCrear={async (nombre) => {
        const nueva = await crearCategoria(nombre);
        onCategoriaCreada?.(nueva);
        // El formulario recibe la categoría completa (con su markup por defecto)
        onChange(nueva);
        return { id: nueva.codCategoria, nombre: nueva.nombreCategoria };
      }}
    />
  );
}
