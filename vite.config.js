import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GITHUB_REPOSITORY = "username/repo-name" → base = "/repo-name/"
// En local ou si pas défini → base = "/"
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base = repoName ? `/${repoName}/` : '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'FiscApp – Déclaration Fiscale',
        short_name: 'FiscApp',
        description: 'Assistant de déclaration fiscale française',
        theme_color: '#1a1f2e',
        background_color: '#1a1f2e',
        display: 'standalone',
        scope: base,
        start_url: base,
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }]
      }
    })
  ]
})
