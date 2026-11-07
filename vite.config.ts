import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      // three.js is by far the largest dependency and only the 3D views need it
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/three/')) return 'three';
            // Keeps the icons used by several pages from becoming dozens of tiny requests
            if (id.includes('/node_modules/lucide-react/')) return 'icons';
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      // Server data files change at runtime and must never trigger a page reload
      watch: process.env.DISABLE_HMR === 'true' ? null : { ignored: ['**/data/**', '**/.backups/**'] },
    },
  };
});
