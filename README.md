# Ampower — 發電機組 3D 檢視器與安裝排程

RZ2000 柴油發電機房的 three.js 檢視器，左側為 3D 模型、右側為安裝排程面板。

| 目錄 | 內容 |
|---|---|
| `app/` | Vue 3 + Vite + TypeScript 應用程式（詳見 [app/README.md](app/README.md)） |
| `3D/` | 21 個 GLB 模型，共用同一組場域座標 |
| `process/` | 來源資料：發電機安裝 24 步驟 |
| `docs/superpowers/specs/` | 設計文件 |

## 功能

**3D 檢視器** — 構件清單（顯示／隱藏／隔離）、爆炸圖、隱藏外牆／外牆透視、
PBR 金屬材質、可嵌入 YouTube 影片的 POI 標記（支援播放區間）。

**排程面板** — 四個分頁：

- **甘特圖**：可拖曳調整工期與開工日，時間游標驅動 3D 施工進度模擬，可播放（0.5–8×）
- **WBS**：兩層工作分解結構，PERT 三點估算（O／M／P）直接編輯
- **網圖**：PDM 前導圖（AON），含 ES/EF、LS/LF、浮時與要徑
- **S 曲線**：計畫值 PV 香蕉包絡與實獲值 EV，SPI 與落後／超前天數

## 開始

```bash
cd app
npm install
npm run dev
```

`app/public/models` 是指向 `3D/` 的 symlink，clone 後即可使用。

```bash
npm test     # 217 個單元測試
npm run build
```
