# 發電機組 3D 檢視器 — 設計文件

日期：2026-09-04

## 目標

為 `power generator` 專案的 21 個 GLB 模型建立一個純 3D 檢視器，功能限定為：
構件清單（顯示／隱藏／隔離）與爆炸圖動畫。視覺風格與渲染設定沿用
`../TaipeiCityHall/scada-vue/src/components/ThreeFloorViewer.vue`。

不做：點選構件資訊卡、剖面、量測、截圖、任何監控資料串接。

## 資產現況（已驗證）

- 21 個 GLB，總計約 23 MB，Blender glTF I/O v5.1 匯出。
- **共用同一組場域座標**：x≈143–168、y≈12–20.4、z≈-232…-248，單位公尺，Y-up。
  以原點載入即自動組裝，不需手動擺位。
- **無 Draco 壓縮**，不需 `DRACOLoader`。
- 使用到的擴充：`KHR_materials_transmission` / `specular` / `ior` / `anisotropy`，
  three 0.169 原生支援。
- `ground.glb` 為 170×170 m 地坪；`機房.glb` 為 23.2×8.4×11.4 m 外殼，會包住所有設備。
- 檔名含中文、全形括號與空白，載入時必須 URL-encode。

## 架構

純 TS 引擎 + 薄 Vue 殼。three 相關邏輯不依賴 Vue，UI 狀態集中於 Pinia。

```
app/
  package.json  vite.config.ts  tsconfig.json  index.html
  public/models/            -> symlink 至 ../../3D
  src/
    main.ts  App.vue
    data/parts.ts           構件 metadata：id/檔名/顯示名/群組/爆炸方向覆寫
    three/
      SceneKit.ts           renderer·camera·controls·lights·env·composer·resize·dispose
      ModelLoader.ts        批次載入 + 進度回報 + 合併包圍盒置中
      PartRegistry.ts       partId -> Object3D；顯示/隱藏/隔離半透明
      Explode.ts            爆炸位移計算 + 平滑插值
    composables/useViewer.ts
    stores/viewer.ts        visible set / isolatedId / explodeFactor / shellOpacity
    components/ ViewerCanvas.vue · PartTree.vue · ExplodeSlider.vue · LoadProgress.vue
    styles/app.css
```

### 單元職責

| 單元 | 職責 | 依賴 |
|---|---|---|
| `SceneKit` | 建立與釋放 renderer/scene/camera/controls/composer，處理 resize 與 render loop | three |
| `ModelLoader` | 依序載入 GLB、回報進度、合併包圍盒、把 root 置中 | three, parts.ts |
| `PartRegistry` | 保存 partId→Object3D 與材質快取，提供 setVisible / setIsolated / setShellOpacity | three |
| `Explode` | 由包圍盒算出每個構件的爆炸方向與位移，依 factor 插值 | three（僅 Vector3/Box3） |
| `stores/viewer` | UI 狀態單一來源 | pinia |

## 關鍵設計決策

1. **整體置中，個別不置中**
   21 個 GLB 掛進同一個 `root: Group`，用合併包圍盒把 root 整體平移到原點
   （`root.position.sub(center)`）。個別構件不各自置中，否則相對位置散掉。
   這是與參考專案 `frameModel()` 的主要差異——該處一次只處理一個模型。

2. **框景排除地坪**
   `ground.glb` 會把包圍盒撐大約 7 倍，導致相機退太遠。框景用的包圍盒排除
   `ground`，只計入機房與設備。

3. **爆炸位移**
   `offset = normalize(partCenter − equipmentCenter) × factor × span`，
   其中 `span` 為設備群包圍盒對角線長。`ground` 與 `機房` 不參與爆炸；
   外殼透明度隨 factor 上升而遞減（自動淡出）。水平長件（煙囪、消音器吊架）
   在 `parts.ts` 覆寫為沿 X 軸推。

4. **隔離與材質快取**
   非選中構件套用 `transparent / opacity 0.12 / depthWrite false`。
   載入時對每個 part 的材質做一次 clone 並快取原始參數，避免同檔內共用材質
   被污染，且還原時不失真。

5. **載入排程**
   依檔案大小由小到大載入，邊載邊顯示，進度條顯示已完成／總數。
   單一檔案失敗不阻斷其他檔案：該項在清單標紅並提供重試。

## 渲染設定（沿用參考專案）

- `ACESFilmicToneMapping`，exposure 0.85
- `PCFSoftShadowMap`，DirectionalLight 依模型尺度配置 shadow camera
- `RoomEnvironment` + `PMREMGenerator` 產生 IBL，`environmentIntensity = 0.5`
- `EffectComposer` → `RenderPass` → `SSAOPass` → `OutputPass`
- `OrbitControls` with damping
- `setPixelRatio(min(devicePixelRatio, 2))`

## 錯誤處理

| 情境 | 行為 |
|---|---|
| 單一 GLB 404 或解析失敗 | 記錄錯誤，該構件在清單標紅並可重試，其餘照常載入 |
| WebGL 無法建立 | 顯示錯誤訊息取代 canvas |
| 全部載入失敗 | 顯示錯誤面板與重試鈕 |

## 測試

以 vitest 對純函式做單元測試（不需 WebGL）：

- `Explode`：位移方向與量值、factor=0 時位移為零、排除清單生效
- `ModelLoader`：包圍盒合併、ground 排除、置中位移計算

## 已確認的取捨

- `public/models` 使用 symlink 指回 `3D/`，避免 23 MB 重複佔用且模型更新自動同步。
- 爆炸圖啟動時機房外殼自動淡出。
