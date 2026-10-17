import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base: the same build works at /platform3D/, /platform3D-next/ and on GitHub Pages.
  base: './',
  server: { port: 5174 },
  build: { target: 'es2022', chunkSizeWarningLimit: 2500 },
});
