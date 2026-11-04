// Vite build and dev server for the React frontend.
// npm run dev    -> http://127.0.0.1:5173, API calls are forwarded to the backend on PORT from the project-root .env
// npm run build  -> frontend/dist, which the backend serves at / in production
import {defineConfig, loadEnv} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '..', '');  // read the shared .env one folder up (only used here, never sent to the browser)
  const backend = env.BACKEND_URL || `http://127.0.0.1:${env.PORT || 8000}`;
  return {
    plugins: [react()],
    envDir: '..',
    server: {host: '127.0.0.1', port: 5173, strictPort: true, proxy: {'/api': backend}},
    build: {outDir: 'dist', emptyOutDir: true},
  };
});
