/**
 * PERT 三點估算。
 *
 * 期望工期 te = (O + 4M + P) / 6，變異數 σ² = ((P − O) / 6)²。
 * 專案的期望完工日取要徑上各活動 te 的總和，變異數同樣只沿要徑累加——
 * 這是 PERT 的標準假設（要徑上的活動彼此獨立），實務上會低估風險，
 * 因為非要徑分支也可能因延遲而變成要徑。
 */

export interface ThreePoint {
  /** 樂觀 */
  o: number
  /** 最可能 */
  m: number
  /** 悲觀 */
  p: number
}

/** 期望工期 */
export function expectedDuration({ o, m, p }: ThreePoint): number {
  return (o + 4 * m + p) / 6
}

/** 單一活動的變異數 */
export function variance({ o, p }: ThreePoint): number {
  return ((p - o) / 6) ** 2
}

export function stdDev(varianceSum: number): number {
  return Math.sqrt(Math.max(0, varianceSum))
}

/**
 * 未指定三點估算時的預設離散度。
 *
 * 樂觀取最可能的 0.8 倍、悲觀取 1.6 倍，並確保 O ≤ M < P。
 * 這只是讓功能一開始就能用的起始值，實際數字應由現場經驗填入。
 */
export function defaultThreePoint(m: number): ThreePoint {
  const safeM = Math.max(0, m)
  return {
    o: Math.max(0, Math.round(safeM * 0.8)),
    m: safeM,
    p: Math.max(safeM + 1, Math.round(safeM * 1.6)),
  }
}

/** 把三點估算調整成合法的 O ≤ M ≤ P，以剛改動的欄位為準 */
export function clampThreePoint(tp: ThreePoint, changed: keyof ThreePoint): ThreePoint {
  const t = { ...tp }
  if (changed === 'm') {
    t.o = Math.min(t.o, t.m)
    t.p = Math.max(t.p, t.m)
  } else if (changed === 'o') {
    t.m = Math.max(t.m, t.o)
    t.p = Math.max(t.p, t.m)
  } else {
    t.m = Math.min(t.m, t.p)
    t.o = Math.min(t.o, t.m)
  }
  return t
}

/** 標準常態分布的累積機率，用 Abramowitz–Stegun 7.1.26 近似 erf */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x)
  return 0.5 * (1 + sign * y)
}

/**
 * 在指定天數內完工的機率。
 * @param targetDays 目標工期（天）
 * @param expectedDays 要徑期望工期
 * @param varianceSum 要徑變異數總和
 */
export function completionProbability(
  targetDays: number,
  expectedDays: number,
  varianceSum: number,
): number {
  const sd = stdDev(varianceSum)
  // 變異數為 0 表示工期完全確定，不是機率問題
  if (sd === 0) return targetDays >= expectedDays ? 1 : 0
  return normalCdf((targetDays - expectedDays) / sd)
}
