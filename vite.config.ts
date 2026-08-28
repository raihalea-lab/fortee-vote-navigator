import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    minify: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/content.ts'),
      formats: ['iife'],
      name: 'ForteeVoteNavigator',
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: 'content.[ext]',
      },
    },
  },
});
