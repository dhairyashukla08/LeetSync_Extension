import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { cpSync, existsSync } from 'fs'

const extRoot = resolve(__dirname, '..')
const dist = resolve(__dirname, '../../dist')

function copyExtensionFiles() {
  return {
    name: 'copy-extension-files',
    closeBundle() {
      console.log('Copying extension files to', dist)
      for (const item of ['manifest.json', 'content', 'background', 'icons']) {
        const from = resolve(extRoot, item)
        if (existsSync(from)) {
          cpSync(from, resolve(dist, item), { recursive: true })
          console.log('  copied', item)
        } else {
          console.log('  MISSING', from)
        }
      }
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), copyExtensionFiles()],
  build: {
    outDir: '../../dist/popup',
    emptyOutDir: true,
    rollupOptions: {
      input: { popup: resolve(__dirname, 'index.html') },
    },
  },
  server: { port: 5174 },
})