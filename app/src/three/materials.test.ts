import { describe, expect, it } from 'vitest'
import { Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Texture } from 'three'
import { PROFILES, applyMaterialProfiles } from './materials'

function partWith(...materials: MeshStandardMaterial[]): Group {
  const g = new Group()
  for (const m of materials) g.add(new Mesh(undefined, m))
  return g
}

const mat = (name: string, extra: Partial<MeshStandardMaterial> = {}) =>
  Object.assign(new MeshStandardMaterial({ name, metalness: 1, roughness: 1 }), extra)

const first = (g: Group) => (g.children[0] as Mesh).material as MeshStandardMaterial

describe('applyMaterialProfiles', () => {
  it('把 roughness 1.0 的金屬改成設定檔的值', () => {
    const g = partWith(mat('metal'))
    applyMaterialProfiles(g, 'p06')
    expect(first(g).roughness).toBe(PROFILES.metal.roughness)
    expect(first(g).metalness).toBe(1)
  })

  it('忽略 Blender 的 .001 尾碼與大小寫', () => {
    const g = partWith(mat('Metal.002'))
    applyMaterialProfiles(g, 'p12')
    expect(first(g).roughness).toBe(PROFILES.metal.roughness)
  })

  it('沒有對應設定的材質原封不動', () => {
    const g = partWith(mat('某個沒見過的材質', { roughness: 0.77 }))
    applyMaterialProfiles(g, 'p09')
    expect(first(g).roughness).toBe(0.77)
  })

  it('yellow_glass 跳過，不破壞 transmission 設定', () => {
    const g = partWith(mat('yellow_glass', { roughness: 0.04, metalness: 0 }))
    applyMaterialProfiles(g, 'p15')
    expect(first(g).roughness).toBe(0.04)
  })

  it('需要清漆的材質會轉成 MeshPhysicalMaterial', () => {
    const g = partWith(mat('body'))
    applyMaterialProfiles(g, 'p20')
    const m = first(g) as MeshPhysicalMaterial
    expect(m.isMeshPhysicalMaterial).toBe(true)
    expect(m.clearcoat).toBe(PROFILES.body.clearcoat)
  })

  it('轉成 physical 時保留原本的貼圖與顏色', () => {
    const map = new Texture()
    const g = partWith(mat('body', { map }))
    const before = first(g).color.getHex()
    applyMaterialProfiles(g, 'p20')
    expect(first(g).map).toBe(map)
    expect(first(g).color.getHex()).toBe(before)
  })

  it('不需要清漆或異向性的材質維持 MeshStandardMaterial', () => {
    const g = partWith(mat('rubber_black'))
    applyMaterialProfiles(g, 'p11')
    expect((first(g) as MeshPhysicalMaterial).isMeshPhysicalMaterial).toBeUndefined()
  })

  it('設定檔有指定顏色時覆寫，沒指定時保留模型原色', () => {
    const withColor = partWith(mat('metal'))
    applyMaterialProfiles(withColor, 'p06')
    expect(first(withColor).color.getHexString()).toBe('ccd0d4')

    const keepColor = partWith(mat('black'))
    const before = first(keepColor).color.getHex()
    applyMaterialProfiles(keepColor, 'p09')
    expect(first(keepColor).color.getHex()).toBe(before)
  })

  it('模型自帶貼圖時不補程序式細節貼圖', () => {
    const roughnessMap = new Texture()
    const g = partWith(mat('metal', { roughnessMap }))
    applyMaterialProfiles(g, 'p06')
    expect(first(g).roughnessMap).toBe(roughnessMap)
    expect(first(g).normalMap).toBeNull()
  })

  it('處理陣列形式的多材質 mesh', () => {
    const g = new Group()
    g.add(new Mesh(undefined, [mat('metal'), mat('rubber_black')]))
    applyMaterialProfiles(g, 'p10')
    const mats = (g.children[0] as Mesh).material as MeshStandardMaterial[]
    expect(mats[0].roughness).toBe(PROFILES.metal.roughness)
    expect(mats[1].roughness).toBe(PROFILES.rubber_black.roughness)
  })
})

describe('逐構件材質覆寫', () => {
  it('匯流排的「銅」是真的銅色', () => {
    const g = partWith(mat('銅'))
    applyMaterialProfiles(g, 'p19')
    expect(first(g).color.getHexString()).toBe('b87333')
  })

  it('消音器命名為「銅」但實際是鍍鋅件，覆寫成一般金屬', () => {
    const g = partWith(mat('銅'))
    applyMaterialProfiles(g, 'p05')
    expect(first(g).color.getHexString()).toBe('ccd0d4')
    expect(first(g).roughness).toBe(PROFILES.metal.roughness)
  })
})

describe('設定檔本身', () => {
  it('沒有任何金屬材質還停留在 roughness 1.0', () => {
    const metals = Object.entries(PROFILES).filter(([, p]) => p.metalness >= 0.9)
    expect(metals.length).toBeGreaterThan(0)
    for (const [name, p] of metals) {
      expect(p.roughness, `${name} 的粗糙度`).toBeLessThan(0.8)
      expect(p.roughness, `${name} 的粗糙度`).toBeGreaterThan(0)
    }
  })
})
