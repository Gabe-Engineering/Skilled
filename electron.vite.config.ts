import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const shared = { '@shared': resolve('src/shared') }

// electron-vite leaves `build.minify` off by default, which shipped a 2.3 MB
// unminified renderer bundle. Turn it on for every process.
export default defineConfig({
  main: {
    resolve: { alias: shared },
    build: { minify: 'esbuild' }
  },
  preload: {
    resolve: { alias: shared },
    build: { minify: 'esbuild' }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        ...shared
      }
    },
    build: {
      minify: 'esbuild',
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          // One vendor chunk for the editor engine and its syntax grammars. They
          // import each other, so splitting them further produces circular chunks.
          manualChunks(id: string) {
            if (
              id.includes('node_modules/@tiptap') ||
              id.includes('node_modules/prosemirror-') ||
              id.includes('node_modules/lowlight') ||
              id.includes('node_modules/highlight.js')
            ) {
              return 'editor'
            }
            return undefined
          }
        }
      }
    },
    plugins: [react()]
  }
})
