// frontend/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

/**
 * Return an HTTPS config object **only** when the PEM files are present.
 * Railway’s build environment never has them, so we skip the HTTPS step.
 */
function getHttpsOptions() {
  try {
    const keyPath = path.resolve(__dirname, 'localhost-key.pem');
    const certPath = path.resolve(__dirname, 'localhost.pem');

    // If either file is missing, `fs.readFileSync` throws → we fall back.
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
  } catch {
    // No local certs → Vite will serve HTTP (Railway does HTTPS on the edge).
    return undefined;
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    https: getHttpsOptions(),
    open: true,
  },
});