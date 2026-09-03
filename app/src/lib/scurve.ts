/**
 * S 曲線（累計進度曲線）與實獲值分析。
 *
 * 計畫值 PV 由排程直接推得：每個活動的工作量在其計畫區間內線性累積。
 * 分別以最早開始與最晚開始各畫一條，形成常見的「香蕉曲線」包絡——
 * 實際進度落在包絡內即屬正常。
 *
 * 實獲值 EV 只有「當下」一個真值（每個活動的完成度百分比）。
 * 資料裡沒有實際進度的時間序列，因此完整的實際曲線需要靠 progressLog
 * 逐次記錄累積，不能從單一時間點的完成度回推。
 */

export interface CurveRow {
  /** 期望工期 te，同時作為工作量權重 */
  duration: number
  start: number
  finish: number
  lateStart: number
  lateFinish: number
  /** 完成度 0–100 */
  progress: number
}

export interface CurvePoint {
  day: number
  pct: number
}

export type Basis = 'early' | 'late'

/** 單一活動在第 t 天已完成的工作量 */
function workBy(row: CurveRow, t: number, basis: Basis): number {
  const start = basis === 'early' ? row.start : row.lateStart
  const finish = basis === 'early' ? row.finish : row.lateFinish
  if (t <= start) return 0
  if (t >= finish) return row.duration
  const span = finish - start
  // 工期 0 的里程碑沒有累積過程，到了就是完成
  if (span <= 0) return row.duration
  return (row.duration * (t - start)) / span
}

export function totalWork(rows: CurveRow[]): number {
  return rows.reduce((s, r) => s + r.duration, 0)
}

/**
 * 取樣日：整數日加上所有活動的起訖點。
 * 只取整數日會把折點切掉，曲線會偏離真實的分段線性形狀。
 */
function sampleDays(rows: CurveRow[], projectDays: number): number[] {
  const days = new Set<number>([0])
  for (let d = 1; d <= Math.ceil(projectDays); d++) days.add(d)
  for (const r of rows) {
    for (const v of [r.start, r.finish, r.lateStart, r.lateFinish]) {
      if (v >= 0 && v <= projectDays) days.add(Number(v.toFixed(6)))
    }
  }
  return [...days].sort((a, b) => a - b)
}

/** 累計計畫完成百分比曲線 */
export function plannedCurve(rows: CurveRow[], projectDays: number, basis: Basis): CurvePoint[] {
  const total = totalWork(rows)
  if (!rows.length || total <= 0) return []
  return sampleDays(rows, projectDays).map((day) => ({
    day,
    pct: (rows.reduce((s, r) => s + workBy(r, day, basis), 0) / total) * 100,
  }))
}

/** 當下的實獲值百分比：各活動工作量以完成度加權 */
export function earnedPct(rows: CurveRow[]): number {
  const total = totalWork(rows)
  if (total <= 0) return 0
  return (rows.reduce((s, r) => s + (r.duration * r.progress) / 100, 0) / total) * 100
}

/** 曲線在指定日的百分比，落在取樣點之間時線性內插 */
export function pctAt(curve: CurvePoint[], day: number): number {
  if (!curve.length) return 0
  if (day <= curve[0].day) return curve[0].pct
  const last = curve[curve.length - 1]
  if (day >= last.day) return last.pct
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1]
    const b = curve[i]
    if (day <= b.day) {
      const span = b.day - a.day
      return span <= 0 ? b.pct : a.pct + ((b.pct - a.pct) * (day - a.day)) / span
    }
  }
  return last.pct
}

/** 曲線第一次達到指定百分比的日子；始終未達到回傳 null */
export function dayAtPct(curve: CurvePoint[], pct: number): number | null {
  if (!curve.length) return null
  if (pct <= curve[0].pct) return curve[0].day
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1]
    const b = curve[i]
    if (pct <= b.pct) {
      const span = b.pct - a.pct
      return span <= 0 ? b.day : a.day + ((b.day - a.day) * (pct - a.pct)) / span
    }
  }
  return null
}

/** 進度績效指標 SPI = EV / PV。PV 為 0（尚未開工）時無意義，回傳 null */
export function spi(evPct: number, pvPct: number): number | null {
  if (pvPct <= 0) return null
  return evPct / pvPct
}

/**
 * 進度差異天數：目前的實獲值在計畫曲線上對應的日子減去資料日期。
 * 正值代表超前，負值代表落後。
 */
export function scheduleVarianceDays(
  planned: CurvePoint[],
  evPct: number,
  dataDay: number,
): number | null {
  const day = dayAtPct(planned, evPct)
  return day === null ? null : day - dataDay
}
