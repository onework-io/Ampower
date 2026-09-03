import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // public/models 是指向 ../../3D 的 symlink，需允許 Vite 讀取專案根目錄之外
    fs: { allow: ['..', '../..'] },
  },
})
