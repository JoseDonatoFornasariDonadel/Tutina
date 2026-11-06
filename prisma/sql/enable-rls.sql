-- Seguridad de Supabase: activa Row Level Security (RLS) en todas las tablas.
--
-- La app NO usa la API pública de Supabase (supabase-js / Data API): accede a la
-- base sólo desde el servidor con Prisma, conectándose como el usuario `postgres`,
-- que es dueño de las tablas y por eso no queda afectado por RLS.
--
-- Al activar RLS sin crear políticas, los roles públicos `anon` y `authenticated`
-- (los que usa la Data API con la anon key) quedan sin acceso a ninguna fila.
-- Además se les quitan los permisos directos sobre tablas y secuencias.
--
-- Es seguro ejecutarlo varias veces. Volver a correrlo si se agregan tablas nuevas.
-- Uso: npm run db:rls   (o pegarlo en el SQL Editor de Supabase)

ALTER TABLE public."ConfiguracionTienda" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Marca" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Categoria" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Temporada" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProductoTemporada" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Descuento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Producto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HistorialPrecioProducto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Talle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Color" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."VarianteProducto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FotoProductoColor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Proveedor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Factura" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DetalleIngreso" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Cliente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EstadoPedido" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Pedido" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DetallePedido" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PedidoEstado" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FormaPago" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PedidoFormaPago" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CategoriaGasto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."GastoOperativo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AlertaWhatsAppLog" ENABLE ROW LEVEL SECURITY;

-- Quitar permisos de los roles públicos de Supabase sobre el esquema public
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Y que las tablas que se creen a futuro tampoco les den permisos por defecto
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
