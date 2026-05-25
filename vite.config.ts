import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'child_process'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'start-express-backend',
      configureServer() {
        console.log('Starting Express API Backend...');
        const apiProcess = spawn('node', ['api/index.js'], {
          stdio: 'inherit',
          shell: true
        });
        
        process.on('exit', () => {
          apiProcess.kill();
        });
        process.on('SIGINT', () => {
          apiProcess.kill();
          process.exit();
        });
      }
    }
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
