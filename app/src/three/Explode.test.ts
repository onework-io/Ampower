import { describe, expect, it } from 'vitest'
import { Box3, Vector3 } from 'three'
import {
  SHELL_GHOST_OPACITY,
  buildExplodePlan,
  explodable,
  explodedPosition,
  shellOpacityFor,
} from './Explode'
import type { PartDef } from '@/data/parts'

const part = (id: string, kind: PartDef['kind'], explodeDir?: [number, number, number]): PartDef => ({
  id,
  file: `${id}.glb`,
  name: id,
  group: 'g',
  kind,
  bytes: 1,
  explodeDir,
})

const box = (cx: number, cy: number, cz: number, r = 1) =>
  new Box3(new Vector3(cx - r, cy - r, cz - r), new Vector3(cx + r, cy + r, cz + r))

describe('explodable', () => {
  it('只有 equipment 參與爆炸', () => {
    expect(explodable(part('a', 'equipment'))).toBe(true)
    expect(explodable(part('shell', 'shell'))).toBe(false)
    expect(explodable(part('ground', 'site'))).toBe(false)
  })
})

describe('buildExplodePlan', () => {
  it('排除外殼與地坪', () => {
    const parts = [part('a', 'equipment'), part('shell', 'shell'), part('ground', 'site')]
    const boxes = new Map([
      ['a', box(1, 0, 0)],
      ['shell', box(0, 0, 0, 50)],
      ['ground', box(0, 0, 0, 500)],
    ])
    const plan = buildExplodePlan(parts, boxes, new Map())
    expect(plan.entries.map((e) => e.id)).toEqual(['a'])
  })

  it('span 只計入設備，不被巨大地坪撐開', () => {
    const parts = [part('a', 'equipment'), part('b', 'equipment'), part('ground', 'site')]
    const boxes = new Map([
      ['a', box(-2, 0, 0)],
      ['b', box(2, 0, 0)],
      ['ground', box(0, 0, 0, 500)],
    ])
    const plan = buildExplodePlan(parts, boxes, new Map())
    // 設備群 x 範圍 -3..3、y/z -1..1 → 對角線 sqrt(36+4+4)
    expect(plan.span).toBeCloseTo(Math.sqrt(44), 6)
  })

  it('預設方向為由群中心指向構件中心', () => {
    const parts = [part('a', 'equipment'), part('b', 'equipment')]
    const boxes = new Map([
      ['a', box(-2, 0, 0)],
      ['b', box(2, 0, 0)],
    ])
    const plan = buildExplodePlan(parts, boxes, new Map())
    const a = plan.entries.find((e) => e.id === 'a')!
    expect(a.dir.x).toBeCloseTo(-1, 6)
    expect(a.dir.y).toBeCloseTo(0, 6)
  })

  it('explodeDir 覆寫預設方向並正規化', () => {
    const parts = [part('a', 'equipment', [0, 0, 5]), part('b', 'equipment')]
    const boxes = new Map([
      ['a', box(-2, 0, 0)],
      ['b', box(2, 0, 0)],
    ])
    const plan = buildExplodePlan(parts, boxes, new Map())
    const a = plan.entries.find((e) => e.id === 'a')!
    expect(a.dir.toArray()).toEqual([0, 0, 1])
  })

  it('構件中心與群中心重合時退回向上，不產生 NaN', () => {
    const parts = [part('a', 'equipment')]
    const boxes = new Map([['a', box(0, 0, 0)]])
    const plan = buildExplodePlan(parts, boxes, new Map())
    expect(plan.entries[0].dir.toArray()).toEqual([0, 1, 0])
  })

  it('保留原始位置供還原', () => {
    const parts = [part('a', 'equipment')]
    const boxes = new Map([['a', box(1, 2, 3)]])
    const positions = new Map([['a', new Vector3(7, 8, 9)]])
    const plan = buildExplodePlan(parts, boxes, positions)
    expect(plan.entries[0].origin.toArray()).toEqual([7, 8, 9])
  })
})

describe('explodedPosition', () => {
  const entry = { id: 'a', origin: new Vector3(1, 1, 1), dir: new Vector3(1, 0, 0) }

  it('factor 0 回到原位', () => {
    expect(explodedPosition(entry, 100, 0).toArray()).toEqual([1, 1, 1])
  })

  it('factor 1 推開 span 的 0.45 倍', () => {
    expect(explodedPosition(entry, 100, 1).toArray()).toEqual([46, 1, 1])
  })

  it('不改動 entry 的原始位置', () => {
    explodedPosition(entry, 100, 1)
    expect(entry.origin.toArray()).toEqual([1, 1, 1])
  })
})

describe('shellOpacityFor', () => {
  it('未爆炸時外殼不透明', () => {
    expect(shellOpacityFor(0)).toBe(1)
  })

  it('factor 0.3 時半透明', () => {
    expect(shellOpacityFor(0.3)).toBeCloseTo(0.5, 6)
  })

  it('factor 0.6 以上完全透明', () => {
    expect(shellOpacityFor(0.6)).toBe(0)
    expect(shellOpacityFor(1)).toBe(0)
  })

  it('開啟外牆透視後即使未爆炸也是半透明', () => {
    expect(shellOpacityFor(0, true)).toBe(SHELL_GHOST_OPACITY)
  })

  it('外牆透視與爆炸淡出取較透明者', () => {
    // factor 0.3 的淡出值 0.5 比透視值不透明，故取透視值
    expect(shellOpacityFor(0.3, true)).toBe(SHELL_GHOST_OPACITY)
    // factor 0.6 已全透明，比透視值更透明，故取 0
    expect(shellOpacityFor(0.6, true)).toBe(0)
  })
})
