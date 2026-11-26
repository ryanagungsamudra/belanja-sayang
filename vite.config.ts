import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

function supabasePreconnectPlugin(supabaseUrl: string): Plugin {
  let origin = ''
  try {
    if (supabaseUrl) origin = new URL(supabaseUrl).origin
  } catch {
    origin = ''
  }

  return {
    name: 'belanjasayang-supabase-preconnect',
    transformIndexHtml(html) {
      if (!origin) return html
      return {
        html,
        tags: [
          {
            tag: 'link',
            attrs: { rel: 'preconnect', href: origin, crossorigin: '' },
            injectTo: 'head',
          },
          {
            tag: 'link',
            attrs: { rel: 'dns-prefetch', href: origin },
            injectTo: 'head',
          },
        ],
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const supabaseUrl = (env.VITE_SUPABASE_URL ?? '').trim()

  return {
    plugins: [
      react(),
      tailwindcss(),
      supabasePreconnectPlugin(supabaseUrl),
      VitePWA({
        registerType: 'autoUpdate',
        manifestFilename: 'manifest.json',
        includeAssets: [
          'favicon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
        ],
        manifest: {
          name: 'BelanjaSayang — Daftar Belanja Pasar',
          short_name: 'BelanjaSayang',
          description:
            'Daftar belanja pasar pribadi yang cepat, 100% offline, dan nyaman dipakai satu tangan.',
          theme_color: '#e8f5ee',
          background_color: '#e8f5ee',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          lang: 'id',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
        },
      }),
    ],
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'vendor-react',
                test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                priority: 25,
              },
              {
                name: 'vendor-realtime',
                test: /node_modules[\\/]@supabase[\\/]/,
                priority: 20,
              },
              {
                name: 'vendor-icons',
                test: /node_modules[\\/]lucide-react[\\/]/,
                priority: 15,
              },
            ],
          },
        },
      },
    },
  }
})
