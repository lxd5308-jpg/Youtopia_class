// TEMP config used only for sandbox testing — safe to delete.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  cacheDir: '/tmp/vite-cache',
})
