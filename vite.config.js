import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Removed @vitejs/plugin-legacy to avoid shipping legacy polyfills to modern browsers

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  build: {
    target: 'es2020', // Compile only down to ES2020 for modern browsers
    rollupOptions: {
      output: {
        manualChunks: {
          // Split Firebase into its own chunk
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/analytics'],
          // Split React and related libraries
          react: ['react', 'react-dom', 'react-router-dom'],
          // Split UI related libraries
          ui: ['framer-motion', 'lottie-react', 'react-intersection-observer'],
          // Third party analytics 
          analytics: ['mixpanel-browser', 'crisp-sdk-web'],
        },
      },
    },
    // Minify output
    minify: 'terser',
    // Reduce chunk size warnings
    chunkSizeWarningLimit: 1000,
  },
}); 