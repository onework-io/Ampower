/**
 * PDM（前導圖法）網圖的版面配置。
 *
 * 活動置於節點、相依以箭線表示。節點依「最長前置路徑長度」分層，
 * 保證每條箭線都由左往右，不會有回頭線。層內順序用重心法（barycenter）
 * 迭代幾輪降低交叉數。
 *
 * 只做座標計算，不碰 DOM，因此可獨立測試。
 */

export interface NetworkInput {
  id: string
  deps: string[]
}

export interface NetworkNode {
  id: string
  /** 由 0 開始的層（欄） */
  layer: number
  /** 層內由 0 開始的序（列） */
  row: number
  x: number
  y: number
}

export interface NetworkEdge {
  from: string
  to: string
}

export interface NetworkLayout {
  nodes: Map<string, NetworkNode>
  edges: NetworkEdge[]
  layers: string[][]
  width: number
  height: number
  /** 相依成環時列出環上的節點，並且不產生版面 */
  cycle: string[] | null
}

export interface LayoutOptions {
  nodeWidth: number
  nodeHeight: number
  /** 層與層的水平間距（節點之間的空白） */
  gapX: number
  /** 同層節點的垂直間距 */
  gapY: number
  padding: number
}

export const DEFAULT_LAYOUT: LayoutOptions = {
  nodeWidth: 152,
  nodeHeight: 78,
  gapX: 76,
  gapY: 22,
  padding: 24,
}

/** 重心法的迭代輪數。3 輪之後改善幅度已經很小 */
const SWEEPS = 3

export function layoutNetwork(
  tasks: NetworkInput[],
  options: Partial<LayoutOptions> = {},
): NetworkLayout {
  const opt = { ...DEFAULT_LAYOUT, ...options }
  const ids = new Set(tasks.map((t) => t.id))
  const deps = new Map(tasks.map((t) => [t.id, t.deps.filter((d) => ids.has(d))]))

  const empty = (cycle: string[] | null): NetworkLayout => ({
    nodes: new Map(),
    edges: [],
    layers: [],
    width: 0,
    height: 0,
    cycle,
  })

  if (!tasks.length) return empty(null)

  // 分層：layer = 前置中最大的 layer + 1。用 Kahn 的順序保證前置先算完
  const indegree = new Map(tasks.map((t) => [t.id, deps.get(t.id)!.length]))
  const successors = new Map<string, string[]>(tasks.map((t) => [t.id, []]))
  for (const t of tasks) for (const d of deps.get(t.id)!) successors.get(d)!.push(t.id)

  const queue = tasks.filter((t) => indegree.get(t.id) === 0).map((t) => t.id)
  const layer = new Map<string, number>()
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    layer.set(id, Math.max(0, ...deps.get(id)!.map((d) => layer.get(d)! + 1)))
    for (const s of successors.get(id)!) {
      const n = indegree.get(s)! - 1
      indegree.set(s, n)
      if (n === 0) queue.push(s)
    }
  }
  if (order.length !== tasks.length) {
    return empty(tasks.map((t) => t.id).filter((id) => !order.includes(id)))
  }

  const layerCount = Math.max(...layer.values()) + 1
  const layers: string[][] = Array.from({ length: layerCount }, () => [])
  // 以拓撲順序填入，讓初始排列本身就大致合理
  for (const id of order) layers[layer.get(id)!].push(id)

  // 重心法：交替往右、往左掃，把節點排到相鄰層鄰居的平均位置附近
  const pos = new Map<string, number>()
  const writePos = () => layers.forEach((l) => l.forEach((id, i) => pos.set(id, i)))
  writePos()

  const barycenter = (id: string, neighbours: string[]) => {
    const known = neighbours.map((n) => pos.get(n)).filter((v): v is number => v !== undefined)
    return known.length ? known.reduce((a, b) => a + b, 0) / known.length : pos.get(id)!
  }

  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    for (let i = 1; i < layers.length; i++) {
      layers[i] = [...layers[i]].sort(
        (a, b) => barycenter(a, deps.get(a)!) - barycenter(b, deps.get(b)!),
      )
      writePos()
    }
    for (let i = layers.length - 2; i >= 0; i--) {
      layers[i] = [...layers[i]].sort(
        (a, b) => barycenter(a, successors.get(a)!) - barycenter(b, successors.get(b)!),
      )
      writePos()
    }
  }

  // 座標：每層垂直置中，整體才不會偏向上方
  const stepX = opt.nodeWidth + opt.gapX
  const stepY = opt.nodeHeight + opt.gapY
  const tallest = Math.max(...layers.map((l) => l.length))
  const contentHeight = tallest * stepY - opt.gapY

  const nodes = new Map<string, NetworkNode>()
  layers.forEach((ids, li) => {
    const colHeight = ids.length * stepY - opt.gapY
    const top = opt.padding + (contentHeight - colHeight) / 2
    ids.forEach((id, ri) => {
      nodes.set(id, {
        id,
        layer: li,
        row: ri,
        x: opt.padding + li * stepX,
        y: top + ri * stepY,
      })
    })
  })

  const edges: NetworkEdge[] = []
  for (const t of tasks) for (const d of deps.get(t.id)!) edges.push({ from: d, to: t.id })

  return {
    nodes,
    edges,
    layers,
    width: opt.padding * 2 + layerCount * stepX - opt.gapX,
    height: opt.padding * 2 + contentHeight,
    cycle: null,
  }
}

/** 計算箭線的正交路徑：由前置右緣出、折兩次、進後續左緣 */
export function edgePath(
  from: NetworkNode,
  to: NetworkNode,
  opt: LayoutOptions = DEFAULT_LAYOUT,
): string {
  const x1 = from.x + opt.nodeWidth
  const y1 = from.y + opt.nodeHeight / 2
  const x2 = to.x
  const y2 = to.y + opt.nodeHeight / 2
  if (Math.abs(y1 - y2) < 0.5) return `M ${x1} ${y1} L ${x2} ${y2}`
  const midX = x1 + Math.max(12, (x2 - x1) / 2)
  return `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`
}
