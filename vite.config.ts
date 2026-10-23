import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const local = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // GramJS (telegram) imports Node built-ins; polyfill them for the browser.
    // `crypto` is NOT polyfilled: crypto-browserify returns Buffers from a second copy of
    // `buffer`, which breaks GramJS's `instanceof Buffer` checks (2FA: "Bytes or str expected").
    nodePolyfills({ include: ['buffer', 'os', 'util', 'events', 'stream', 'path', 'net', 'constants', 'process'], globals: { Buffer: true, process: true, global: true } }),
  ],
  resolve: {
    alias: [
      // GramJS ships a WebCrypto-based implementation for browsers.
      { find: /^crypto$/, replacement: local('./node_modules/telegram/crypto/crypto.js') },
      // One Buffer class for everyone: both `require('buffer')` and the injected global
      // must resolve to the same (ESM) shim, otherwise instanceof checks fail.
      { find: /^buffer$/, replacement: local('./node_modules/vite-plugin-node-polyfills/shims/buffer/dist/index.js') },
      { find: /^vite-plugin-node-polyfills\/shims\/buffer$/, replacement: local('./node_modules/vite-plugin-node-polyfills/shims/buffer/dist/index.js') },
    ],
  },
  optimizeDeps: { include: ['telegram'] },
})
