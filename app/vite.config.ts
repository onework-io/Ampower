import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // 相對路徑，讓同一份 build 在 GitHub Pages 的子路徑（/Ampower/）與根路徑都能跑
  base: './',
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // public/models 是指向 ../../3D 的 symlink，需允許 Vite 讀取專案根目錄之外
    fs: { allow: ['..', '../..'] },
  },
})
