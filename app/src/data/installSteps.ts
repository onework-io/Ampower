/**
 * 發電機安裝 24 步驟（來源：process/發電機安裝24步驟 (1).xlsx）。
 *
 * 原始 xlsx 只有「項次／3D模塊名稱／CAD檔／規格數據／實際照片」欄位，
 * 沒有工期、日期或相依關係，因此以下排程是依機電安裝的施工邏輯建立的草案，
 * 可在甘特圖介面上直接調整（調整結果存在瀏覽器）。
 *
 * 與 xlsx 項次順序的唯一差異：「3 設備安裝放樣」提前為第一步。
 * 放樣是定位作業，要先放樣才知道基座澆在哪，排在基座之後不合施工邏輯。
 */

export interface InstallStep {
  /** 穩定識別碼 */
  id: string
  /** xlsx 的項次，介面上仍以此顯示 */
  seq: number
  name: string
  /** 對應 parts.ts 的構件 id；null 表示這個步驟沒有 3D 模型 */
  partId: string | null
  phase: string
  /** 最可能工期（PERT 的 M）。排程實際使用的是三點估算的期望值 te */
  durationDays: number
  /** 樂觀工期（PERT 的 O）。未指定時由 defaultThreePoint 依 M 推算 */
  optimisticDays?: number
  /** 悲觀工期（PERT 的 P）。未指定時由 defaultThreePoint 依 M 推算 */
  pessimisticDays?: number
  /** 前置步驟 id */
  deps: string[]
  /**
   * 本步驟完成後，後續步驟還需等待的天數（混凝土養護）。
   * 放在前置步驟上而非每條相依邊上，對這個規模的排程已足夠。
   */
  lagDays?: number
}

/** WBS 第一層：階段。第二層為個別步驟，代號如 2.1 */
export const PHASES = ['前置', '基礎', '主設備', '排煙', '燃油', '電氣'] as const

/** 階段 → WBS 第一層代號（1 起算） */
export const PHASE_WBS = new Map(PHASES.map((p, i) => [p as string, String(i + 1)]))

export const INSTALL_STEPS: InstallStep[] = [
  { id: 's03', seq: 3, name: '設備安裝放樣（非設備）', partId: null, phase: '前置', durationDays: 1, deps: [] },

  { id: 's01', seq: 1, name: '發電機水泥基座', partId: 'p01', phase: '基礎', durationDays: 3, deps: ['s03'], lagDays: 7 },
  { id: 's02', seq: 2, name: '變壓器水泥基座', partId: null, phase: '基礎', durationDays: 2, deps: ['s03'], lagDays: 7 },
  { id: 's04', seq: 4, name: '消音器重型吊架', partId: 'p04', phase: '基礎', durationDays: 2, deps: ['s03'] },
  { id: 's08', seq: 8, name: '發電機組用避震基座', partId: 'p08', phase: '基礎', durationDays: 1, deps: ['s01'] },

  { id: 's09', seq: 9, name: '發電機組本體 RZ2000', partId: 'p09', phase: '主設備', durationDays: 2, deps: ['s08'] },
  { id: 's18', seq: 18, name: '升壓變壓器', partId: null, phase: '主設備', durationDays: 2, deps: ['s02'] },
  { id: 's05', seq: 5, name: '消音器-45dB', partId: 'p05', phase: '主設備', durationDays: 1, deps: ['s04'] },
  { id: 's14', seq: 14, name: '日用油槽（960L替代）', partId: 'p14', phase: '主設備', durationDays: 1, deps: ['s01'] },

  { id: 's10', seq: 10, name: '煙囪避震軟管（法蘭螺絲）', partId: 'p10', phase: '排煙', durationDays: 1, deps: ['s09', 's05'] },
  { id: 's06', seq: 6, name: '組合式煙囪 16"', partId: 'p06', phase: '排煙', durationDays: 3, deps: ['s05'] },
  { id: 's07', seq: 7, name: '煙囪穿牆蓋板', partId: 'p07', phase: '排煙', durationDays: 1, deps: ['s06'] },
  { id: 's11', seq: 11, name: '消音箱軟接', partId: 'p11', phase: '排煙', durationDays: 1, deps: ['s06'] },
  { id: 's12', seq: 12, name: '消音箱本體', partId: 'p12', phase: '排煙', durationDays: 2, deps: ['s11'] },
  { id: 's13', seq: 13, name: '消音箱風罩', partId: 'p13', phase: '排煙', durationDays: 1, deps: ['s12'] },
  { id: 's24', seq: 24, name: '煙囪保溫', partId: null, phase: '排煙', durationDays: 2, deps: ['s07', 's13'] },

  { id: 's15', seq: 15, name: '油水分離器 Filter', partId: 'p15', phase: '燃油', durationDays: 1, deps: ['s14'] },
  { id: 's16', seq: 16, name: '柴油二次配管', partId: 'p16', phase: '燃油', durationDays: 3, deps: ['s15', 's09'] },

  { id: 's17', seq: 17, name: '隔震電箱', partId: 'p17', phase: '電氣', durationDays: 1, deps: ['s09'] },
  { id: 's19', seq: 19, name: '匯流排', partId: 'p19', phase: '電氣', durationDays: 2, deps: ['s18', 's17'] },
  { id: 's20', seq: 20, name: '充電器', partId: 'p20', phase: '電氣', durationDays: 1, deps: ['s17'] },
  { id: 's21', seq: 21, name: '啟動電池組', partId: 'p21', phase: '電氣', durationDays: 1, deps: ['s20'] },
  { id: 's22', seq: 22, name: '缸套加熱電盤', partId: 'p22', phase: '電氣', durationDays: 1, deps: ['s17'] },
  { id: 's23', seq: 23, name: '本體配線', partId: null, phase: '電氣', durationDays: 4, deps: ['s16', 's19', 's21', 's22'] },
]

export const STEP_BY_ID = new Map(INSTALL_STEPS.map((s) => [s.id, s]))
