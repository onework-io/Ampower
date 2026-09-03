import { describe, expect, it } from 'vitest'
import { BoxGeometry, Group, Mesh, Object3D } from 'three'
import { applyUnitAlignment } from './alignment'
import { UNIT_SPLIT_Z, UNIT_Y_OFFSET } from '@/data/alignment'

/** 造一個中心在 (0, y, z)、邊長 1 的節點，模擬一台機組的那一份 */
function unit(y: number, z: number): Object3D {
  const m = new Mesh(new BoxGeometry(1, 1, 1))
  m.position.set(0, y, z)
  return m
}

/** 右側（z < -237.6）與左側各一份 */
function twoUnits(rightY: number, leftY: number): Group {
  const g = new Group()
  g.add(unit(rightY, -239.2), unit(leftY, -236))
  return g
}

const RIGHT = 0
const LEFT = 1

describe('applyUnitAlignment', () => {
  it('只位移右側那一份，左側不動', () => {
    const g = twoUnits(10, 8)
    const moved = applyUnitAlignment(g, 'p09')
    expect(moved).toBe(1)
    expect(g.children[RIGHT].position.y).toBeCloseTo(10 + UNIT_Y_OFFSET.p09, 6)
    expect(g.children[LEFT].position.y).toBe(8)
  })

  it('位移後兩份的高度差正好等於原本的差減去修正量', () => {
    // 右側原本比左側高 1.0146，套用 p09 的 -1.0146 後應完全對齊
    const g = twoUnits(14.2094, 13.1947)
    applyUnitAlignment(g, 'p09')
    // 修正值取到小數 4 位，殘差在 0.1 mm 等級
    expect(g.children[RIGHT].position.y).toBeCloseTo(g.children[LEFT].position.y, 3)
  })

  it('沒有登記修正的構件完全不動', () => {
    const g = twoUnits(10, 8)
    expect(applyUnitAlignment(g, 'p05')).toBe(0)
    expect(g.children[RIGHT].position.y).toBe(10)
    expect(g.children[LEFT].position.y).toBe(8)
  })

  it('橫跨兩台的共用構件不位移，即使中心落在右側', () => {
    const g = new Group()
    const wide = new Mesh(new BoxGeometry(1, 1, 12)) // z 從 -244 到 -232，兩側都跨很多
    wide.position.set(0, 10, -238)
    g.add(wide)
    expect(applyUnitAlignment(g, 'p09')).toBe(0)
    expect(wide.position.y).toBe(10)
  })

  it('只略微越過分界的節點仍算右側，不被誤判成共用構件', () => {
    const g = new Group()
    const near = new Mesh(new BoxGeometry(1, 1, 0.6)) // z 從 -238.1 到 -237.5，只越界 0.1
    near.position.set(0, 10, -237.8)
    g.add(near)
    expect(applyUnitAlignment(g, 'p09')).toBe(1)
  })

  it('分界線恰在 UNIT_SPLIT_Z：略小於的算右側，略大於的算左側', () => {
    const g = new Group()
    g.add(unit(10, UNIT_SPLIT_Z - 0.1), unit(10, UNIT_SPLIT_Z + 0.1))
    applyUnitAlignment(g, 'p13')
    expect(g.children[0].position.y).toBeCloseTo(10 + UNIT_Y_OFFSET.p13, 6)
    expect(g.children[1].position.y).toBe(10)
  })

  it('空物件不會爆', () => {
    expect(applyUnitAlignment(new Group(), 'p09')).toBe(0)
  })

  it('位移後世界矩陣已更新，後續包圍盒計算才會拿到新位置', () => {
    const g = twoUnits(10, 8)
    applyUnitAlignment(g, 'p09')
    expect(g.children[RIGHT].matrixWorld.elements[13]).toBeCloseTo(10 + UNIT_Y_OFFSET.p09, 6)
  })
})

describe('修正表', () => {
  it('每個登記的構件 id 都存在於 parts.ts', async () => {
    const { PARTS } = await import('@/data/parts')
    const ids = new Set(PARTS.map((p) => p.id))
    for (const id of Object.keys(UNIT_Y_OFFSET)) {
      expect(ids.has(id), `${id} 應存在於 PARTS`).toBe(true)
    }
  })

  it('沒有登記 0 位移的無用項目', () => {
    for (const [id, dy] of Object.entries(UNIT_Y_OFFSET)) {
      expect(dy, `${id}`).not.toBe(0)
    }
  })
})
