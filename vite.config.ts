import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base so the build works both under a GitHub Pages project path
// (username.github.io/repo/) and under a future custom domain served at "/".
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
