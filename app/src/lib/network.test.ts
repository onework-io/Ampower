import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYOUT, edgePath, layoutNetwork, type NetworkInput } from './network'

const t = (id: string, ...deps: string[]): NetworkInput => ({ id, deps })

describe('分層', () => {
  it('沒有前置的節點都在第 0 層', () => {
    const l = layoutNetwork([t('a'), t('b')])
    expect(l.nodes.get('a')!.layer).toBe(0)
    expect(l.nodes.get('b')!.layer).toBe(0)
  })

  it('層 = 前置中最深者 + 1', () => {
    const l = layoutNetwork([t('a'), t('b', 'a'), t('c', 'b'), t('d', 'a', 'c')])
    expect(l.nodes.get('b')!.layer).toBe(1)
    expect(l.nodes.get('c')!.layer).toBe(2)
    expect(l.nodes.get('d')!.layer).toBe(3) // 取 c 的 2 + 1，而非 a 的 0 + 1
  })

  it('每條箭線都由左往右，沒有回頭線', () => {
    const tasks = [t('a'), t('b', 'a'), t('c', 'a'), t('d', 'b', 'c'), t('e', 'a', 'd')]
    const l = layoutNetwork(tasks)
    for (const e of l.edges) {
      expect(l.nodes.get(e.from)!.layer).toBeLessThan(l.nodes.get(e.to)!.layer)
    }
  })

  it('未知的相依會被忽略，不影響分層', () => {
    const l = layoutNetwork([t('a', 'ghost'), t('b', 'a')])
    expect(l.cycle).toBeNull()
    expect(l.nodes.get('a')!.layer).toBe(0)
    expect(l.edges).toEqual([{ from: 'a', to: 'b' }])
  })
})

describe('錯誤處理', () => {
  it('相依成環時回報環上節點且不產生版面', () => {
    const l = layoutNetwork([t('a', 'b'), t('b', 'a')])
    expect(l.cycle).toEqual(['a', 'b'])
    expect(l.nodes.size).toBe(0)
  })

  it('空清單不會爆', () => {
    const l = layoutNetwork([])
    expect(l.nodes.size).toBe(0)
    expect(l.cycle).toBeNull()
    expect(l.width).toBe(0)
  })
})

describe('座標', () => {
  it('同層的節點 x 相同、y 依序遞增', () => {
    const l = layoutNetwork([t('a'), t('b'), t('c')])
    const [a, b, c] = ['a', 'b', 'c'].map((id) => l.nodes.get(id)!)
    expect(a.x).toBe(b.x)
    expect(b.x).toBe(c.x)
    const ys = [a, b, c].map((n) => n.y).sort((p, q) => p - q)
    expect(ys[1] - ys[0]).toBe(DEFAULT_LAYOUT.nodeHeight + DEFAULT_LAYOUT.gapY)
  })

  it('相鄰層的水平間距固定', () => {
    const l = layoutNetwork([t('a'), t('b', 'a')])
    expect(l.nodes.get('b')!.x - l.nodes.get('a')!.x).toBe(
      DEFAULT_LAYOUT.nodeWidth + DEFAULT_LAYOUT.gapX,
    )
  })

  it('節點較少的層會垂直置中', () => {
    // 第 0 層 3 個、第 1 層 1 個
    const l = layoutNetwork([t('a'), t('b'), t('c'), t('d', 'a', 'b', 'c')])
    const col0 = ['a', 'b', 'c'].map((id) => l.nodes.get(id)!.y)
    const mid = (Math.min(...col0) + Math.max(...col0)) / 2
    expect(l.nodes.get('d')!.y).toBeCloseTo(mid, 6)
  })

  it('整體寬高涵蓋所有節點與留白', () => {
    const l = layoutNetwork([t('a'), t('b', 'a')])
    for (const n of l.nodes.values()) {
      expect(n.x + DEFAULT_LAYOUT.nodeWidth).toBeLessThanOrEqual(l.width)
      expect(n.y + DEFAULT_LAYOUT.nodeHeight).toBeLessThanOrEqual(l.height)
    }
  })
})

describe('減少交叉', () => {
  /** 數一數箭線兩兩相交的次數（同一對相鄰層之間，順序顛倒即為交叉） */
  function crossings(tasks: NetworkInput[]) {
    const l = layoutNetwork(tasks)
    let n = 0
    for (let i = 0; i < l.edges.length; i++) {
      for (let j = i + 1; j < l.edges.length; j++) {
        const a = l.edges[i]
        const b = l.edges[j]
        const af = l.nodes.get(a.from)!
        const bf = l.nodes.get(b.from)!
        if (af.layer !== bf.layer) continue
        const at = l.nodes.get(a.to)!
        const bt = l.nodes.get(b.to)!
        if (at.layer !== bt.layer) continue
        if ((af.row - bf.row) * (at.row - bt.row) < 0) n++
      }
    }
    return n
  }

  it('交錯的相依會被排到不交叉', () => {
    // a→d、b→c 若維持原順序必定交叉，重心法應該把它們換過來
    expect(crossings([t('a'), t('b'), t('c', 'b'), t('d', 'a')])).toBe(0)
  })

  it('結果穩定：同樣輸入跑兩次一致', () => {
    const tasks = [t('a'), t('b'), t('c', 'a', 'b'), t('d', 'a'), t('e', 'c', 'd')]
    const first = [...layoutNetwork(tasks).nodes.values()].map((n) => `${n.id}:${n.layer}:${n.row}`)
    const second = [...layoutNetwork(tasks).nodes.values()].map((n) => `${n.id}:${n.layer}:${n.row}`)
    expect(second).toEqual(first)
  })
})

describe('edgePath', () => {
  it('同高的節點畫直線', () => {
    const from = { id: 'a', layer: 0, row: 0, x: 0, y: 0 }
    const to = { id: 'b', layer: 1, row: 0, x: 228, y: 0 }
    expect(edgePath(from, to)).toBe(
      `M ${DEFAULT_LAYOUT.nodeWidth} 39 L 228 39`,
    )
  })

  it('不同高的節點畫正交折線', () => {
    const from = { id: 'a', layer: 0, row: 0, x: 0, y: 0 }
    const to = { id: 'b', layer: 1, row: 1, x: 228, y: 100 }
    const d = edgePath(from, to)
    expect(d).toContain('H')
    expect(d).toContain('V')
  })
})
