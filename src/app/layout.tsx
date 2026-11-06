import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'Tutina | Sistema de Gestión de Indumentaria & E-Commerce',
  description:
    'Sistema integral de gestión de catálogo, costos, markup, pedidos, alertas de stock por WhatsApp y reportes financieros de Tutina.',
};

// viewport-fit=cover permite usar env(safe-area-inset-*) para respetar el notch del iPhone.
// No se limita el zoom (maximumScale) para no afectar la accesibilidad.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#18181b' },
  ],
};

const aplicarTemaGuardadoScript = `
(function() {
  try {
    if (localStorage.getItem('tutina_dark_mode') === 'true') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

const stripExtensionAttributesScript = `
(function() {
  try {
    var cleanAttrs = ['bis_skin_checked', 'bis_register', '__processed_'];
    function stripNode(node) {
      if (node && node.nodeType === 1) {
        for (var i = 0; i < cleanAttrs.length; i++) {
          if (node.hasAttribute && node.hasAttribute(cleanAttrs[i])) {
            node.removeAttribute(cleanAttrs[i]);
          }
        }
      }
    }
    function cleanAll() {
      var els = document.querySelectorAll('[bis_skin_checked], [bis_register]');
      for (var i = 0; i < els.length; i++) {
        els[i].removeAttribute('bis_skin_checked');
        els[i].removeAttribute('bis_register');
      }
    }
    cleanAll();
    var obs = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === 'attributes') {
          stripNode(m.target);
        } else if (m.type === 'childList' && m.addedNodes) {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var n = m.addedNodes[j];
            stripNode(n);
            if (n && n.querySelectorAll) {
              var sub = n.querySelectorAll('[bis_skin_checked], [bis_register]');
              for (var k = 0; k < sub.length; k++) {
                sub[k].removeAttribute('bis_skin_checked');
                sub[k].removeAttribute('bis_register');
              }
            }
          }
        }
      }
    });
    obs.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['bis_skin_checked', 'bis_register']
    });
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Aplica el modo oscuro guardado antes de pintar, para evitar el destello claro */}
        <script dangerouslySetInnerHTML={{ __html: aplicarTemaGuardadoScript }} />
        <script dangerouslySetInnerHTML={{ __html: stripExtensionAttributesScript }} />
      </head>
      <body suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
