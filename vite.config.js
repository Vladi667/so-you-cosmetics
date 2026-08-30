import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  build: {
    // La construction serveur ne produit que du balisage : elle n'a aucun besoin
    // de recopier public/, soit 14 Mo de photos et de vidéos qui existent déjà
    // dans dist/. Sans cette ligne, chaque déploiement transportait deux fois
    // les mêmes fichiers.
    copyPublicDir: !isSsrBuild,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
}))
