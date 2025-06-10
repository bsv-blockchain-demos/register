import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      '@quarkid/did-core': path.resolve(__dirname, '../../packages/did/core/src/index.ts'),
      '@quarkid/did-registry': path.resolve(__dirname, '../../packages/did/registry/src/index.ts'),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    hmr: {
      overlay: false, // Disable the HMR overlay to prevent issues with React refresh
    },
  },
})
