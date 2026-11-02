// Hosts externos cuyas imágenes optimiza Next. Mantener en sync con
// HOSTS_OPTIMIZABLES en src/components/tienda/ImagenProducto.tsx.
// Las fotos subidas desde el panel se sirven desde /api/imagenes (mismo dominio).
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/**' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;
