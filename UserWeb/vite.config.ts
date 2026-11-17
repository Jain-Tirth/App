import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { pwaPlugin } from './vite/pwaPlugin';

export default defineConfig({
  plugins: [react(), pwaPlugin()],
  server: {
    port: 5174,
  },
});
