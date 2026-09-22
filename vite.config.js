import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5175, open: false },
  build: {
    // The curriculum text itself is the bulk of the bundle and every route needs
    // it, so it is loaded eagerly on purpose — that makes chapter-to-chapter
    // navigation instant with no further network requests. Routes are still
    // code-split (see the lazy() calls in App.jsx) so MUI-heavy pages are deferred.
    chunkSizeWarningLimit: 900,
  },
})
