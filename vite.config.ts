// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

function getHttpsOptions() {
  try {
    const keyPath = path.resolve(__dirname, 'localhost-key.pem');
    const certPath = path.resolve(__dirname, 'localhost.pem');
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
  } catch {
    return undefined;
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    https: getHttpsOptions(),
    open: true,
    // This proxy is essential for local development to avoid CORS/Mixed-Content errors
    proxy: {
      // ✅ CHANGED: Added 'generate-voiceover' to the list of proxied paths
      '^/(reconstruct|segment|health|recolor|generate-voiceover)': {
        target: 'http://127.0.0.1:8000', // Your Python backend
        changeOrigin: true,
      },
    },
  },
});