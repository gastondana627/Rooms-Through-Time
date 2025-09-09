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
  define: {
    'process.env': {}
  },
  server: {
    https: getHttpsOptions(),
    open: true,
    proxy: {
      // ✅ UPDATED: Added the new redesign endpoint to the proxy rule.
      '^/(generate-fal-image|generate-voiceover|segment|recolor|reconstruct|health|description.*\\.mp3|redesign-fal-image|chat-with-avatar|get-designer-quote|generate-character-voice|.*_voice\\.mp3)': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});