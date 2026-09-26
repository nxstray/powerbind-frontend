import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

const publicDir = fileURLToPath(new URL('./public', import.meta.url))

// Vitest evaluates modules with Node's ESM/CJS loader. A root-relative URL such
// as `/favicon.ico` (used by component templates for files in `public/`) is
// therefore turned into the URL `file:///favicon.ico`, and Node rejects that
// value on Windows because it has no drive letter. Map those URLs back to the
// real file in `public/` so the asset resolves like any other asset.
// Production builds are unaffected: public assets already end up as a literal
// URL in the bundle, never as a module import.
const publicAssetResolver = {
  name: 'vitest-public-assets',
  enforce: 'pre',
  apply: (_config, env) => env.command === 'serve' && env.mode === 'test',
  resolveId(id) {
    if (!id.startsWith('/') || id.startsWith('//')) return
    const [pathname, query] = id.split('?')
    const file = path.join(publicDir, pathname)
    if (!file.startsWith(publicDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return
    }
    return { id: query ? `${file}?${query}` : file }
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
    publicAssetResolver,
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    global: 'globalThis',
  },
  // Vitest config — read automatically because Vitest uses the same
  // vite.config.js (no separate config file needed)
  test: {
    environment: 'jsdom',
    globals: true,
    // Coverage config — lcov is what SonarQube consumes (sonar.javascript.lcov.reportPaths)
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      exclude: ['src/**/*.test.js', 'src/**/*.spec.js', 'src/**/icons/**'],
    },
  },
})