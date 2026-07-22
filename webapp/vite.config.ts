import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Rutas relativas: la app puede servirse desde cualquier subruta de GitHub
// Pages (usuario.github.io/repo/) sin tener que fijar el nombre del repo
// aqui. Combinado con HashRouter, evita 404 al refrescar/enlazar rutas.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    fs: {
      // La pantalla "Log" importa el CHANGELOG.md de la RAÍZ del repositorio
      // (un nivel por encima de webapp/) para su pestaña "Programa". Sin este
      // permiso, el servidor de desarrollo se niega a servir un fichero fuera
      // de su raíz. En la compilación no hace falta: ahí se resuelve y se
      // empaqueta como un import más.
      allow: ['..'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
