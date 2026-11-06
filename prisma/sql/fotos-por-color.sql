-- Galería de fotos por color (equivale a `npm run db:push` para este cambio).
-- Uso: pegarlo en el SQL Editor de Supabase. Es seguro ejecutarlo varias veces.
--
-- Cada prenda tiene una galería de fotos por color; todos los talles de ese color la
-- comparten. La foto con menor "orden" es la portada y la app la copia a
-- VarianteProducto.imagenVariante. Las fotos que ya existían (una por talle) pasan solas
-- a la galería la primera vez que se abre «Gestionar fotos» de la prenda.

CREATE TABLE IF NOT EXISTS public."FotoProductoColor" (
    "idFoto" SERIAL NOT NULL,
    "codProducto" INTEGER NOT NULL,
    "codColor" INTEGER NOT NULL,
    "imagen" TEXT NOT NULL,
    "huella" TEXT NOT NULL DEFAULT '',
    "orden" INTEGER NOT NULL DEFAULT 0,
    "fechaAlta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotoProductoColor_pkey" PRIMARY KEY ("idFoto"),
    CONSTRAINT "FotoProductoColor_codProducto_fkey" FOREIGN KEY ("codProducto")
        REFERENCES public."Producto"("codProducto") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FotoProductoColor_codColor_fkey" FOREIGN KEY ("codColor")
        REFERENCES public."Color"("codColor") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "FotoProductoColor_codProducto_codColor_orden_idx"
    ON public."FotoProductoColor"("codProducto", "codColor", "orden");
CREATE INDEX IF NOT EXISTS "FotoProductoColor_codColor_idx"
    ON public."FotoProductoColor"("codColor");

-- Misma seguridad que el resto de las tablas (ver enable-rls.sql)
ALTER TABLE public."FotoProductoColor" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."FotoProductoColor" FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public."FotoProductoColor_idFoto_seq" FROM anon, authenticated;
