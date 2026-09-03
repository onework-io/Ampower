import { describe, expect, it } from 'vitest'
import {
  clampThreePoint,
  completionProbability,
  defaultThreePoint,
  expectedDuration,
  normalCdf,
  stdDev,
  variance,
} from './pert'

describe('expectedDuration', () => {
  it('te = (O + 4M + P) / 6', () => {
    expect(expectedDuration({ o: 2, m: 4, p: 12 })).toBeCloseTo(5, 10)
  })

  it('三點相同時等於該值', () => {
    expect(expectedDuration({ o: 3, m: 3, p: 3 })).toBe(3)
  })

  it('悲觀值拉高會把期望值往上帶', () => {
    expect(expectedDuration({ o: 3, m: 3, p: 9 })).toBeGreaterThan(3)
  })
})

describe('variance', () => {
  it('σ² = ((P − O) / 6)²', () => {
    expect(variance({ o: 2, m: 4, p: 8 })).toBeCloseTo(1, 10)
  })

  it('沒有離散度時變異數為 0', () => {
    expect(variance({ o: 5, m: 5, p: 5 })).toBe(0)
  })

  it('與最可能值無關', () => {
    expect(variance({ o: 2, m: 3, p: 8 })).toBe(variance({ o: 2, m: 7, p: 8 }))
  })
})

describe('defaultThreePoint', () => {
  it('悲觀一定大於最可能，否則變異數會是 0', () => {
    for (const m of [0, 1, 2, 3, 4, 10]) {
      const tp = defaultThreePoint(m)
      expect(tp.p, `m=${m}`).toBeGreaterThan(tp.m)
    }
  })

  it('樂觀不超過最可能', () => {
    for (const m of [1, 2, 3, 4, 10]) {
      const tp = defaultThreePoint(m)
      expect(tp.o).toBeLessThanOrEqual(tp.m)
    }
  })

  it('m 為 1 時仍給得出合法的三點', () => {
    expect(defaultThreePoint(1)).toEqual({ o: 1, m: 1, p: 2 })
  })

  it('負值視為 0', () => {
    expect(defaultThreePoint(-5).m).toBe(0)
  })
})

describe('clampThreePoint', () => {
  it('調高最可能時推開悲觀', () => {
    expect(clampThreePoint({ o: 2, m: 10, p: 6 }, 'm')).toEqual({ o: 2, m: 10, p: 10 })
  })

  it('調高最可能時壓低樂觀', () => {
    expect(clampThreePoint({ o: 8, m: 3, p: 12 }, 'm')).toEqual({ o: 3, m: 3, p: 12 })
  })

  it('調高樂觀時連帶推開最可能與悲觀', () => {
    expect(clampThreePoint({ o: 9, m: 4, p: 6 }, 'o')).toEqual({ o: 9, m: 9, p: 9 })
  })

  it('調低悲觀時連帶壓低最可能與樂觀', () => {
    expect(clampThreePoint({ o: 5, m: 8, p: 2 }, 'p')).toEqual({ o: 2, m: 2, p: 2 })
  })

  it('本來就合法就不動', () => {
    const tp = { o: 2, m: 4, p: 8 }
    expect(clampThreePoint(tp, 'm')).toEqual(tp)
  })
})

describe('normalCdf', () => {
  it('z = 0 為 0.5', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6)
  })

  it.each([
    [1, 0.8413],
    [-1, 0.1587],
    [1.645, 0.95],
    [-1.96, 0.025],
    [2, 0.9772],
  ])('z = %s → %s', (z, expected) => {
    expect(normalCdf(z)).toBeCloseTo(expected, 3)
  })

  it('對稱：F(z) + F(−z) = 1', () => {
    for (const z of [0.3, 1, 2.5]) {
      expect(normalCdf(z) + normalCdf(-z)).toBeCloseTo(1, 6)
    }
  })
})

describe('completionProbability', () => {
  it('目標等於期望值時約為 50%', () => {
    expect(completionProbability(20, 20, 4)).toBeCloseTo(0.5, 6)
  })

  it('目標比期望值多一個標準差時約 84%', () => {
    expect(completionProbability(22, 20, 4)).toBeCloseTo(0.8413, 3)
  })

  it('目標早於期望值時低於 50%', () => {
    expect(completionProbability(18, 20, 4)).toBeLessThan(0.5)
  })

  it('變異數為 0 時不是機率問題，只看有沒有達標', () => {
    expect(completionProbability(20, 20, 0)).toBe(1)
    expect(completionProbability(19, 20, 0)).toBe(0)
  })
})

describe('stdDev', () => {
  it('負的變異數視為 0，不產生 NaN', () => {
    expect(stdDev(-1)).toBe(0)
  })
})
