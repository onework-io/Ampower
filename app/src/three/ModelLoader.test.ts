import { describe, expect, it } from 'vitest'
import { Box3, BoxGeometry, Group, Mesh, Object3D, Vector3 } from 'three'
import { centerOffset, framingBox, type LoadedPart } from './ModelLoader'
import type { PartDef } from '@/data/parts'

const def = (id: string, kind: PartDef['kind']): PartDef => ({
  id,
  file: `${id}.glb`,
  name: id,
  group: 'g',
  kind,
  bytes: 1,
})

/** 造一個以 (cx,cy,cz) 為中心、邊長 size 的立方體物件 */
function cube(cx: number, cy: number, cz: number, size: number): Object3D {
  const m = new Mesh(new BoxGeometry(size, size, size))
  m.position.set(cx, cy, cz)
  m.updateMatrixWorld(true)
  return m
}

const loaded = (entries: [string, PartDef['kind'], Object3D][]): LoadedPart[] =>
  entries.map(([id, kind, object]) => ({ def: def(id, kind), object }))

describe('framingBox', () => {
  it('排除地坪，只框設備與外殼', () => {
    const box = framingBox(
      loaded([
        ['shell', 'shell', cube(0, 0, 0, 20)],
        ['gen', 'equipment', cube(0, 0, 0, 6)],
        ['ground', 'site', cube(0, 0, 0, 340)],
      ]),
    )
    expect(box.getSize(new Vector3()).x).toBe(20)
  })

  it('沒有地坪時結果不變', () => {
    const box = framingBox(loaded([['gen', 'equipment', cube(0, 0, 0, 6)]]))
    expect(box.getSize(new Vector3()).x).toBe(6)
  })

  it('多個構件時取聯集', () => {
    const box = framingBox(
      loaded([
        ['a', 'equipment', cube(-5, 0, 0, 2)],
        ['b', 'equipment', cube(5, 0, 0, 2)],
      ]),
    )
    expect(box.min.x).toBe(-6)
    expect(box.max.x).toBe(6)
  })

  it('只有地坪時退回完整包圍盒，不回傳空盒', () => {
    const box = framingBox(loaded([['ground', 'site', cube(0, 0, 0, 340)]]))
    expect(box.isEmpty()).toBe(false)
    expect(box.getSize(new Vector3()).x).toBe(340)
  })

  it('什麼都沒載入時回傳空盒', () => {
    expect(framingBox([]).isEmpty()).toBe(true)
  })

  it('傳入已位移的 root 時扣掉其位移，回傳 local 座標', () => {
    const root = new Group()
    root.position.set(-150, -16, 240)
    root.updateMatrixWorld(true)
    const box = framingBox(loaded([['gen', 'equipment', cube(0, 0, 0, 6)]]), root)
    // 世界座標中心 0,0,0；扣掉 root 位移後 local 中心為 150,16,-240
    expect(box.getCenter(new Vector3()).toArray()).toEqual([150, 16, -240])
  })

  it('重複框景不會累積位移', () => {
    const root = new Group()
    const items = loaded([['gen', 'equipment', cube(150, 16, -240, 6)]])
    for (const { object } of items) root.add(object)

    for (let i = 0; i < 3; i++) {
      root.updateMatrixWorld(true)
      const box = framingBox(items, root)
      root.position.copy(box.getCenter(new Vector3())).negate()
    }
    root.updateMatrixWorld(true)
    expect(root.position.toArray()).toEqual([-150, -16, 240])
  })
})

describe('centerOffset', () => {
  it('回傳把包圍盒中心移到原點的位移', () => {
    const box = new Box3(new Vector3(140, 12, -250), new Vector3(160, 20, -230))
    expect(centerOffset(box).toArray()).toEqual([-150, -16, 240])
  })

  it('空盒回傳零位移', () => {
    expect(centerOffset(new Box3().makeEmpty()).toArray()).toEqual([0, 0, 0])
  })
})
