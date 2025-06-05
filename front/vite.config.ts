import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@quarkid/did-core': path.resolve(__dirname, '../../packages/did/core/src/index.ts'),
      '@quarkid/did-registry': path.resolve(__dirname, '../../packages/did/registry/src/index.ts'),
    },
  },
  plugins: [react()],
})
