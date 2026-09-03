/**
 * 21 個 GLB 構件的靜態 metadata。
 *
 * 所有模型共用同一組場域座標（公尺、Y-up），以原點載入即自動組裝，
 * 因此這裡不記錄位置，只記錄分類與爆炸圖的方向覆寫。
 */

/** 構件在場景中的角色，決定框景、爆炸與透明度處理 */
export type PartKind =
  | 'equipment' // 一般設備：參與框景、參與爆炸
  | 'shell' // 機房外殼：參與框景、不爆炸、爆炸時淡出
  | 'site' // 地坪：不參與框景、不爆炸

export interface PartDef {
  /** 穩定識別碼，供 store 與 registry 使用 */
  id: string
  /** public/models/ 底下的檔名（含中文與全形括號，載入時需 encodeURIComponent） */
  file: string
  /** 清單顯示名稱 */
  name: string
  /** 分組標題 */
  group: string
  kind: PartKind
  /** 檔案位元組數，用於由小到大的載入排程與進度權重 */
  bytes: number
  /**
   * 爆炸方向覆寫（世界座標，會被正規化）。
   * 未指定時由「構件包圍盒中心 − 設備群中心」推導。
   * 水平長件（煙囪、消音器吊架）用徑向推會擠在一起，故明確指定。
   */
  explodeDir?: [number, number, number]
}

const G_SITE = '場域'
const G_SHELL = '機房'
const G_BASE = '基礎'
const G_GEN = '發電機組'
const G_EXHAUST = '排氣與消音'
const G_FUEL = '燃油系統'
const G_ELEC = '電氣'

/** 依檔案由小到大排序，即為載入順序（小檔先進畫面） */
export const PARTS: PartDef[] = [
  { id: 'p13', file: '13_消音箱風罩(詳圖面).glb', name: '消音箱風罩', group: G_EXHAUST, kind: 'equipment', bytes: 8876 },
  { id: 'p11', file: '11_消音箱軟接(詳圖面).glb', name: '消音箱軟接', group: G_EXHAUST, kind: 'equipment', bytes: 22616 },
  { id: 'p12', file: '12_消音箱本體(詳圖面).glb', name: '消音箱本體', group: G_EXHAUST, kind: 'equipment', bytes: 39152 },
  { id: 'p07', file: '7_煙囪穿牆蓋板(詳圖面).glb', name: '煙囪穿牆蓋板', group: G_EXHAUST, kind: 'equipment', bytes: 43224, explodeDir: [-1, 0.35, 0] },
  { id: 'p19', file: '19_匯流排(詳圖面).glb', name: '匯流排', group: G_ELEC, kind: 'equipment', bytes: 49044 },
  { id: 'p21', file: '21_啟動電池組.glb', name: '啟動電池組', group: G_ELEC, kind: 'equipment', bytes: 78092 },
  { id: 'p22', file: '22_缸套加熱電盤.glb', name: '缸套加熱電盤', group: G_ELEC, kind: 'equipment', bytes: 81460 },
  { id: 'p04', file: '4_消音器重型吊架.glb', name: '消音器重型吊架', group: G_EXHAUST, kind: 'equipment', bytes: 111776, explodeDir: [-0.6, 1, 0] },
  { id: 'p17', file: '17_隔震電箱.glb', name: '隔震電箱', group: G_ELEC, kind: 'equipment', bytes: 135868 },
  { id: 'p16', file: '16_柴油二次配管(詳圖面).glb', name: '柴油二次配管', group: G_FUEL, kind: 'equipment', bytes: 258952 },
  { id: 'p05', file: '5_消音器-45dB_1.glb', name: '消音器 45dB', group: G_EXHAUST, kind: 'equipment', bytes: 288788 },
  { id: 'p08', file: '8_發電機組用避震基座.glb', name: '發電機組用避震基座', group: G_BASE, kind: 'equipment', bytes: 320864 },
  { id: 'p10', file: '10_煙囪避震軟管（法蘭螺絲）.glb', name: '煙囪避震軟管', group: G_EXHAUST, kind: 'equipment', bytes: 404660 },
  { id: 'p14', file: '14_日用油槽（960L替代）.glb', name: '日用油槽 960L', group: G_FUEL, kind: 'equipment', bytes: 413800 },
  { id: 'p15', file: '15_油水分離器Filter.glb', name: '油水分離器 Filter', group: G_FUEL, kind: 'equipment', bytes: 425272 },
  { id: 'p20', file: '20_充電器(參考22P2).glb', name: '充電器', group: G_ELEC, kind: 'equipment', bytes: 563572 },
  { id: 'p06', file: '6 組合式煙囪16_.glb', name: '組合式煙囪', group: G_EXHAUST, kind: 'equipment', bytes: 640840, explodeDir: [-1, 0.3, 0] },
  { id: 'ground', file: 'ground.glb', name: '地坪', group: G_SITE, kind: 'site', bytes: 4339580 },
  { id: 'p01', file: '1_發電機水泥基座.glb', name: '發電機水泥基座', group: G_BASE, kind: 'equipment', bytes: 4340660 },
  { id: 'shell', file: '機房.glb', name: '機房外殼', group: G_SHELL, kind: 'shell', bytes: 4390104 },
  { id: 'p09', file: '9_發電機組本體RZ2000.glb', name: '發電機組本體 RZ2000', group: G_GEN, kind: 'equipment', bytes: 6423224 },
]

/** 清單顯示順序（依機電邏輯，非載入順序） */
export const GROUP_ORDER = [G_GEN, G_BASE, G_EXHAUST, G_FUEL, G_ELEC, G_SHELL, G_SITE]

export const TOTAL_BYTES = PARTS.reduce((s, p) => s + p.bytes, 0)

/** 機房外殼的構件 id，供「隱藏外牆／外牆透視」按鈕使用 */
export const SHELL_PART_ID = PARTS.find((p) => p.kind === 'shell')!.id

/** 模型檔的公開路徑；檔名含中文與括號，必須編碼 */
export function modelUrl(file: string): string {
  return `models/${encodeURIComponent(file)}`
}
