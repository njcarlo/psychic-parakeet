import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'manifest.webmanifest'],
      manifest: false,
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === '/api/jobs' || url.pathname === '/api/jobs/today',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'cleanops-jobs',
              networkTimeoutSeconds: 4,
              expiration: {
                maxEntries: 12,
                maxAgeSeconds: 60 * 60 * 24
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
  preview: {
    port: 5174
  }
});
