import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const monacoEsm = fileURLToPath(new URL('./node_modules/monaco-editor/esm/', import.meta.url))

export default defineConfig({
  // Relative asset paths so the built dist/ works from any static host or sub-path.
  base: './',
  plugins: [react()],
  resolve: {
    // monaco-editor >= 0.55 has an "exports" map that breaks deep imports like
    // "monaco-editor/esm/vs/editor/editor.api.js" (used by y-monaco). Point them
    // straight at the files so the app and y-monaco share one Monaco instance.
    alias: [
      { find: /^monaco-editor\/esm\/(.*)$/, replacement: `${monacoEsm}$1` },
      // Monaco vendors an outdated DOMPurify; use the patched npm package instead.
      { find: /^\.\/dompurify\/dompurify\.js$/, replacement: 'dompurify' },
    ],
  },
  optimizeDeps: {
    // Pre-bundling would give y-monaco its own copy of Monaco.
    exclude: ['monaco-editor', 'y-monaco'],
  },
  build: {
    // Monaco alone is ~3.5 MB minified (~0.9 MB gzipped); that's expected.
    chunkSizeWarningLimit: 4000,
  },
  worker: {
    format: 'es',
  },
})
