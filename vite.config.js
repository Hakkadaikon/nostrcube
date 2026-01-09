
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Some Nostr libraries need process.env or global
    global: 'window',
  }
});
