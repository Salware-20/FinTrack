import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Las actualizaciones entran solas en la siguiente visita.
      registerType: 'autoUpdate',
      // Inyecta el registro del service worker en el HTML: no hace falta
      // tocar src/main.tsx.
      injectRegister: 'auto',
      manifest: {
        name: 'FinTrack · Gestor de Finanzas Personales',
        short_name: 'FinTrack',
        description: 'Gestor de finanzas personales local-first',
        lang: 'es-CR',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0d6efd',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        // Todo el shell de la app queda precacheado para funcionar offline.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        // Cualquier ruta del SPA se resuelve con el index cacheado.
        navigateFallback: '/index.html',
      },
      devOptions: { enabled: false },
    }),
  ],
})
