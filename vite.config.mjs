import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    cssInjectedByJsPlugin()
  ],
  build: {
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/main.jsx'),
      name: 'RPGTrackerSillyTavern',
      formats: ['es'],
      fileName: () => 'bundle.js',
    },
    rollupOptions: {
      external: [], 
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  }
});