import {
  Color,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Vector2,
  type Material,
} from 'three'
import { detailMaps } from './detailMaps'

/**
 * PBR 材質設定檔。
 *
 * 模型匯出時 26 種材質裡有 21 種是 roughness = 1.0。金屬（metalness = 1）
 * 在粗糙度 1.0 下完全散射、沒有連貫反射，在 IBL 下就渲染成一片死灰——
 * 這是所有金屬看起來像灰色黏土的原因。
 *
 * 材質名稱在各個 GLB 之間是共用且語意化的（`metal` 出現在 11 個檔、
 * `steel` 6 個），因此以「材質名」為索引比逐構件設定精準得多。
 */

export interface MaterialProfile {
  /** 覆寫 base color；未指定則保留模型原色 */
  color?: string
  metalness: number
  roughness: number
  /** 烤漆面的清漆層 */
  clearcoat?: number
  clearcoatRoughness?: number
  /** 拉絲金屬的異向性反射 */
  anisotropy?: number
  /** 套用哪一種程序式細節貼圖 */
  detail?: 'metal' | 'brushed'
  /** 細節貼圖的平鋪次數 */
  detailRepeat?: number
  /** 法線強度 */
  normalScale?: number
}

/** 名稱一律轉小寫並去掉 Blender 的 .001 尾碼後比對 */
export const PROFILES: Record<string, MaterialProfile> = {
  // ── 金屬 ──────────────────────────────────────────
  // 鍍鋅鋼板：機組外殼、煙囪、消音箱等的通用金屬
  metal: { color: '#ccd0d4', metalness: 1, roughness: 0.42, detail: 'metal', detailRepeat: 4 },
  // 不鏽鋼板：電箱、穿牆蓋板
  steel: { color: '#d4d7db', metalness: 1, roughness: 0.32, detail: 'brushed', detailRepeat: 3 },
  // 鍍鋅角鋼／支撐件（模型命名為「鈦」）
  鈦: { color: '#c0c6cc', metalness: 1, roughness: 0.55, detail: 'metal', detailRepeat: 6 },
  // 銅：匯流排與缸套加熱電盤的導體
  銅: { color: '#b87333', metalness: 1, roughness: 0.3, detail: 'metal', detailRepeat: 4 },
  // 拉絲不鏽鋼配管（模型已帶 KHR_materials_anisotropy）
  gray_metal: {
    color: '#c2c7cc',
    metalness: 1,
    roughness: 0.33,
    anisotropy: 0.65,
    detail: 'brushed',
    detailRepeat: 8,
    normalScale: 0.6,
  },

  // ── 烤漆與塑膠 ────────────────────────────────────
  // 設備機殼烤漆：金屬度應接近 0 再加清漆層，而非模型原本的 metalness 0.77
  body: { metalness: 0.05, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.25 },
  white: { metalness: 0.05, roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.3 },
  generate: { metalness: 0.03, roughness: 0.4, clearcoat: 0.55, clearcoatRoughness: 0.22 },
  plastic_green: { metalness: 0.03, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.3 },
  'mint green': { metalness: 0.03, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.25 },
  black: { metalness: 0.05, roughness: 0.55 },
  black_frame: { metalness: 0.1, roughness: 0.5 },
  red: { metalness: 0.02, roughness: 0.4, clearcoat: 0.4, clearcoatRoughness: 0.3 },
  orange: { metalness: 0.02, roughness: 0.45 },
  green: { metalness: 0.02, roughness: 0.35 },
  screen: { metalness: 0.1, roughness: 0.22 },
  紗網: { metalness: 0.2, roughness: 0.6 },

  // ── 橡膠 ──────────────────────────────────────────
  rubber_black: { metalness: 0, roughness: 0.88 },
  rubber_brown: { metalness: 0, roughness: 0.9 },
  rubber_orange: { metalness: 0, roughness: 0.88 },

  // ── 土建 ──────────────────────────────────────────
  // 水泥基座已帶 baseColor / metallicRoughness / normal 三張貼圖，只調參數不動貼圖
  concrete: { metalness: 0, roughness: 0.95 },
  wall: { metalness: 0, roughness: 0.92 },
  floor: { metalness: 0.02, roughness: 0.4 }, // 環氧樹脂地坪，半光澤
  door: { metalness: 0.6, roughness: 0.5 },
  material: { metalness: 0.05, roughness: 0.7 },
}

/**
 * 逐構件的材質名覆寫。
 *
 * 消音器的材質命名為「銅」，但實務上消音器是鍍鋅／不鏽鋼件而非銅；
 * 只有匯流排與缸套加熱電盤的「銅」是真的導體銅。
 */
const PART_MATERIAL_ALIAS: Record<string, Record<string, string>> = {
  p05: { 銅: 'metal' }, // 消音器 45dB
}

/** yellow_glass 帶 KHR_materials_transmission，改參數會破壞透光，直接跳過 */
const SKIP = new Set(['yellow_glass'])

const normalize = (name: string) => name.split('.')[0].trim().toLowerCase()

function toPhysical(m: MeshStandardMaterial): MeshPhysicalMaterial {
  if ((m as MeshPhysicalMaterial).isMeshPhysicalMaterial) return m as MeshPhysicalMaterial
  // 逐項複製而非 copy()：copy() 會期待來源具備 physical 專屬欄位
  const p = new MeshPhysicalMaterial({
    name: m.name,
    color: m.color,
    map: m.map,
    normalMap: m.normalMap,
    normalScale: m.normalScale.clone(),
    roughness: m.roughness,
    roughnessMap: m.roughnessMap,
    metalness: m.metalness,
    metalnessMap: m.metalnessMap,
    aoMap: m.aoMap,
    aoMapIntensity: m.aoMapIntensity,
    emissive: m.emissive,
    emissiveMap: m.emissiveMap,
    emissiveIntensity: m.emissiveIntensity,
    alphaMap: m.alphaMap,
    transparent: m.transparent,
    opacity: m.opacity,
    depthWrite: m.depthWrite,
    side: m.side,
    flatShading: m.flatShading,
    vertexColors: m.vertexColors,
  })
  return p
}

function applyProfile(material: MeshStandardMaterial, profile: MaterialProfile): Material {
  const needsPhysical = profile.clearcoat !== undefined || profile.anisotropy !== undefined
  const m = needsPhysical ? toPhysical(material) : material

  if (profile.color) m.color = new Color(profile.color)
  m.metalness = profile.metalness
  m.roughness = profile.roughness

  if (profile.detail && !m.roughnessMap && !m.normalMap) {
    // 只在模型沒有自己的貼圖時補程序式細節，才不會蓋掉水泥基座那類真實貼圖
    const maps = detailMaps(profile.detail, profile.detailRepeat ?? 4)
    if (maps) {
      m.roughnessMap = maps.roughnessMap
      m.normalMap = maps.normalMap
      const ns = profile.normalScale ?? 0.35
      m.normalScale = new Vector2(ns, ns)
    }
  }

  if (needsPhysical) {
    const p = m as MeshPhysicalMaterial
    if (profile.clearcoat !== undefined) {
      p.clearcoat = profile.clearcoat
      p.clearcoatRoughness = profile.clearcoatRoughness ?? 0.3
    }
    if (profile.anisotropy !== undefined) p.anisotropy = profile.anisotropy
  }

  m.needsUpdate = true
  return m
}

/**
 * 把設定檔套到一個構件的所有 mesh 上。
 * 找不到對應設定的材質原封不動保留。
 */
export function applyMaterialProfiles(root: Object3D, partId: string): void {
  const alias = PART_MATERIAL_ALIAS[partId] ?? {}

  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return

    const apply = (mat: Material): Material => {
      const key = normalize(mat.name)
      if (SKIP.has(key)) return mat
      const profile = PROFILES[alias[key] ?? key]
      if (!profile) return mat
      return applyProfile(mat as MeshStandardMaterial, profile)
    }

    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(apply)
      : apply(mesh.material)
  })
}
