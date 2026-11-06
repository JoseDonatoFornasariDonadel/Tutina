-- Límite de intentos de inicio de sesión del panel (equivale a `npm run db:push` para
-- este cambio). Uso: pegarlo en el SQL Editor de Supabase. Es seguro ejecutarlo varias veces.
--
-- Guarda los intentos fallidos de cada conexión (como huella cifrada, no la IP) para
-- bloquear 15 minutos después de 5 contraseñas incorrectas. Los registros de más de un
-- día se borran solos.

CREATE TABLE IF NOT EXISTS public."IntentoAccesoAdmin" (
    "idIntento" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "exitoso" BOOLEAN NOT NULL DEFAULT false,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntentoAccesoAdmin_pkey" PRIMARY KEY ("idIntento")
);

CREATE INDEX IF NOT EXISTS "IntentoAccesoAdmin_clave_fecha_idx"
    ON public."IntentoAccesoAdmin"("clave", "fecha");
CREATE INDEX IF NOT EXISTS "IntentoAccesoAdmin_fecha_idx"
    ON public."IntentoAccesoAdmin"("fecha");

-- Misma seguridad que el resto de las tablas (ver enable-rls.sql)
ALTER TABLE public."IntentoAccesoAdmin" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."IntentoAccesoAdmin" FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public."IntentoAccesoAdmin_idIntento_seq" FROM anon, authenticated;
