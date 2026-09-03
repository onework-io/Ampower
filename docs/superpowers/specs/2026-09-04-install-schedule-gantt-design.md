# 發電機安裝排程與甘特圖介面 — 設計文件

日期：2026-09-04
延續 [3D 檢視器設計](2026-09-04-generator-3d-viewer-design.md)

## 來源資料

`process/發電機安裝24步驟 (1).xlsx`，單一工作表，欄位為
「項次／3D模塊名稱／3D-2D的CAD檔／規格數據／實際照片」，後兩欄全空。

**該檔沒有任何工期、日期或相依關係。** 排程因此是依機電安裝施工邏輯建立的草案，
寫在 `src/data/installSteps.ts`，使用者可在介面上調整。

項次編號與 `3D/` 的 GLB 檔名一一對應，故甘特圖可直接連動 3D。
5 個步驟沒有對應模型：2 變壓器水泥基座、3 設備安裝放樣、18 升壓變壓器、
23 本體配線、24 煙囪保溫。

## 排程草案的兩個判斷

1. **「3 設備安裝放樣」提前為第一步**。放樣是定位作業，要先放樣才知道基座澆在哪；
   照 xlsx 項次排在基座之後不合施工邏輯。其餘步驟維持項次的相對順序。

2. **導入 lag（前置完成後的等待日）**，掛在前置步驟上而非每條相依邊。
   用來表達混凝土養護：基座澆置 3 天結束後要等 7 天才能吊裝設備。
   若把養護灌進工期裡，長條圖會看起來像在施工。

結果：總工期 21 天，要徑為
放樣 → 發電機水泥基座（含 7 天養護）→ 避震基座 → 機組本體 →
柴油二次配管／隔震電箱／匯流排／充電器／啟動電池組 → 本體配線。

## 日曆制

以連續日（含週末）計算，週末在時間軸標底色但不跳過。

考慮過工作日制，但混凝土養護的等待本來就是連續日，與工期混用兩種日制會讓
lag 的語意不一致而更容易算錯。工地若採六日工作制，調整工期天數即可。

## 架構

| 單元 | 職責 | 依賴 |
|---|---|---|
| `src/data/installSteps.ts` | 24 步驟的靜態定義 | — |
| `src/lib/schedule.ts` | 要徑法：拓撲排序、正推 ES/EF、逆推 LS/LF、浮時、環偵測 | 無（純函式） |
| `src/stores/schedule.ts` | 使用者調整（釘選開工日／工期／完成度）、游標、localStorage | pinia |
| `src/components/SplitPane.vue` | 可拖曳的左右分割，比例存 localStorage | — |
| `src/components/gantt/GanttPanel.vue` | 時間軸、任務表、游標、播放 | schedule + viewer store |
| `src/components/gantt/GanttBar.vue` | 單一長條的拖曳（移動／改工期） | schedule store |

排程引擎是唯一會算錯又不容易一眼看出的部分，因此抽成純函式並以 vitest 覆蓋
（正推、lag、釘選、要徑、浮時、成環、未知相依、空清單，以及對實際 24 步驟的斷言）。

## 與 3D 的連動

兩條，都是單向由甘特圖寫入 viewer store：

1. **點任務 → 隔離構件**：`selectedId` 變動時查 `partId`，寫入 `viewer.isolatedId`。
   沒有模型的步驟不動 3D。

2. **進度游標 → 進度模擬**：`installedPartIds` 為游標日期前已完工步驟的構件集合，
   寫入 `viewer.progressFilter`，由 `PartRegistry` 併入既有的顯示計算：

   ```
   visible = wantVisible && installedFilter && opacity > 0
   ```

   過濾只作用於 `kind === 'equipment'`；機房外殼與地坪不隨進度出現或消失，
   否則模擬時會失去空間參照。開啟模擬時自動打開「外牆透視」，
   否則設備在機房裡看不見。

## 資料保存

`localStorage`：排程調整、開工日、游標位置（`generator-schedule-v1`）與
分割比例（`generator-split-ratio`）。讀寫都包 try/catch，隱私模式或配額不足時
退回預設值而不影響操作。

覆寫只存使用者實際改過的欄位，因此日後修改 `installSteps.ts` 的預設排程仍會生效。
