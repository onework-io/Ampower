import { describe, expect, it } from 'vitest'
import {
  dayAtPct,
  earnedPct,
  pctAt,
  plannedCurve,
  scheduleVarianceDays,
  spi,
  totalWork,
  type CurveRow,
} from './scurve'

const row = (
  duration: number,
  start: number,
  progress = 0,
  late = start,
): CurveRow => ({
  duration,
  start,
  finish: start + duration,
  lateStart: late,
  lateFinish: late + duration,
  progress,
})

describe('plannedCurve', () => {
  it('從 0% 開始、以 100% 結束', () => {
    const c = plannedCurve([row(4, 0), row(6, 4)], 10, 'early')
    expect(c[0].pct).toBe(0)
    expect(c[c.length - 1].pct).toBeCloseTo(100, 6)
  })

  it('工作量以工期加權，不是每項各佔一半', () => {
    // 前段 2 天、後段 8 天：第 2 天時只完成 20%
    const c = plannedCurve([row(2, 0), row(8, 2)], 10, 'early')
    expect(pctAt(c, 2)).toBeCloseTo(20, 6)
  })

  it('活動進行中時線性累積', () => {
    const c = plannedCurve([row(4, 0)], 4, 'early')
    expect(pctAt(c, 1)).toBeCloseTo(25, 6)
    expect(pctAt(c, 3)).toBeCloseTo(75, 6)
  })

  it('單調不遞減', () => {
    const c = plannedCurve([row(3, 0), row(2, 1), row(5, 4)], 9, 'early')
    for (let i = 1; i < c.length; i++) expect(c[i].pct).toBeGreaterThanOrEqual(c[i - 1].pct)
  })

  it('最晚開始的曲線不會早於最早開始的曲線', () => {
    const rows = [row(2, 0, 0, 3), row(4, 2, 0, 2)]
    const early = plannedCurve(rows, 8, 'early')
    const late = plannedCurve(rows, 8, 'late')
    for (let d = 0; d <= 8; d++) {
      expect(pctAt(late, d)).toBeLessThanOrEqual(pctAt(early, d) + 1e-9)
    }
  })

  it('取樣點包含活動的起訖日，折點不會被切掉', () => {
    const c = plannedCurve([row(1, 2.5)], 5, 'early')
    expect(c.some((p) => Math.abs(p.day - 2.5) < 1e-9)).toBe(true)
    expect(c.some((p) => Math.abs(p.day - 3.5) < 1e-9)).toBe(true)
  })

  it('工期 0 的里程碑不會產生 NaN', () => {
    const c = plannedCurve([row(0, 2), row(4, 0)], 4, 'early')
    for (const p of c) expect(Number.isFinite(p.pct)).toBe(true)
  })

  it('空清單回傳空陣列', () => {
    expect(plannedCurve([], 10, 'early')).toEqual([])
  })

  it('總工作量為 0 時回傳空陣列，不會除以零', () => {
    expect(plannedCurve([row(0, 0)], 5, 'early')).toEqual([])
  })
})

describe('earnedPct', () => {
  it('依工期加權，不是各項平均', () => {
    // 2 天的做完、8 天的沒做 → 20%
    expect(earnedPct([row(2, 0, 100), row(8, 2, 0)])).toBeCloseTo(20, 6)
  })

  it('全部完成為 100%', () => {
    expect(earnedPct([row(2, 0, 100), row(8, 2, 100)])).toBeCloseTo(100, 6)
  })

  it('尚未開工為 0%', () => {
    expect(earnedPct([row(2, 0), row(8, 2)])).toBe(0)
  })

  it('空清單為 0，不會除以零', () => {
    expect(earnedPct([])).toBe(0)
  })
})

describe('pctAt', () => {
  const c = [
    { day: 0, pct: 0 },
    { day: 4, pct: 40 },
    { day: 10, pct: 100 },
  ]

  it('取樣點之間線性內插', () => {
    expect(pctAt(c, 2)).toBeCloseTo(20, 6)
    expect(pctAt(c, 7)).toBeCloseTo(70, 6)
  })

  it('超出範圍時取兩端值', () => {
    expect(pctAt(c, -5)).toBe(0)
    expect(pctAt(c, 99)).toBe(100)
  })

  it('空曲線回傳 0', () => {
    expect(pctAt([], 3)).toBe(0)
  })
})

describe('dayAtPct', () => {
  const c = [
    { day: 0, pct: 0 },
    { day: 4, pct: 40 },
    { day: 10, pct: 100 },
  ]

  it('回傳第一次達到該百分比的日子', () => {
    expect(dayAtPct(c, 20)).toBeCloseTo(2, 6)
    expect(dayAtPct(c, 70)).toBeCloseTo(7, 6)
  })

  it('與 pctAt 互為反向', () => {
    for (const d of [1, 3, 6, 9]) {
      expect(dayAtPct(c, pctAt(c, d))!).toBeCloseTo(d, 6)
    }
  })

  it('曲線始終未達到該百分比時回傳 null', () => {
    expect(dayAtPct([{ day: 0, pct: 0 }, { day: 5, pct: 50 }], 80)).toBeNull()
  })
})

describe('spi', () => {
  it('EV 等於 PV 時為 1', () => {
    expect(spi(40, 40)).toBe(1)
  })

  it('落後時小於 1、超前時大於 1', () => {
    expect(spi(30, 40)).toBeCloseTo(0.75, 6)
    expect(spi(50, 40)).toBeCloseTo(1.25, 6)
  })

  it('尚未開工（PV 為 0）時無意義，回傳 null 而非 Infinity', () => {
    expect(spi(0, 0)).toBeNull()
    expect(spi(10, 0)).toBeNull()
  })
})

describe('scheduleVarianceDays', () => {
  const planned = [
    { day: 0, pct: 0 },
    { day: 10, pct: 100 },
  ]

  it('實際落後計畫時為負值', () => {
    // 第 5 天應該完成 50%，只完成 30% → 相當於落後 2 天
    expect(scheduleVarianceDays(planned, 30, 5)).toBeCloseTo(-2, 6)
  })

  it('實際超前計畫時為正值', () => {
    expect(scheduleVarianceDays(planned, 70, 5)).toBeCloseTo(2, 6)
  })

  it('恰好符合計畫時為 0', () => {
    expect(scheduleVarianceDays(planned, 50, 5)).toBeCloseTo(0, 6)
  })
})

describe('totalWork', () => {
  it('是各活動期望工期的總和', () => {
    expect(totalWork([row(2, 0), row(3.5, 2)])).toBeCloseTo(5.5, 6)
  })
})
