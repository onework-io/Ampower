import { Box3, Vector3 } from 'three'
import type { PartDef } from '@/data/parts'

/** 單一構件的爆炸資料：原始位置與單位方向 */
export interface ExplodeEntry {
  id: string
  /** 構件在 root 內的原始 local 位置 */
  origin: Vector3
  /** 已正規化的爆炸方向 */
  dir: Vector3
}

export interface ExplodePlan {
  entries: ExplodeEntry[]
  /** 位移比例基準：設備群包圍盒對角線長 */
  span: number
}

/** 只有 equipment 會爆炸；外殼與地坪留在原處 */
export function explodable(part: PartDef): boolean {
  return part.kind === 'equipment'
}

/**
 * 由各構件包圍盒推導爆炸計畫。
 *
 * 方向預設為「構件中心 → 設備群中心」的反向（徑向散開）。
 * 構件若在 parts.ts 指定 explodeDir 則以其為準，用於煙囪這類水平長件
 * ——它們的中心貼近群中心，徑向推會全部擠在一起。
 *
 * @param boxes 已載入構件的世界包圍盒（root 置中後的座標）
 */
export function buildExplodePlan(
  parts: PartDef[],
  boxes: Map<string, Box3>,
  positions: Map<string, Vector3>,
): ExplodePlan {
  const targets = parts.filter((p) => explodable(p) && boxes.has(p.id))

  const groupBox = new Box3()
  groupBox.makeEmpty()
  for (const p of targets) groupBox.union(boxes.get(p.id)!)

  const span = groupBox.isEmpty() ? 0 : groupBox.getSize(new Vector3()).length()
  const center = groupBox.isEmpty() ? new Vector3() : groupBox.getCenter(new Vector3())

  const entries: ExplodeEntry[] = []
  for (const p of targets) {
    const dir = new Vector3()
    if (p.explodeDir) {
      dir.fromArray(p.explodeDir)
    } else {
      boxes.get(p.id)!.getCenter(dir).sub(center)
    }
    // 構件中心與群中心重合且未指定方向時，退回垂直向上，避免 normalize 得到零向量
    if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0)
    dir.normalize()

    entries.push({
      id: p.id,
      origin: (positions.get(p.id) ?? new Vector3()).clone(),
      dir,
    })
  }

  return { entries, span }
}

/**
 * 依爆炸係數算出構件位置。
 * factor 0 → 原位；factor 1 → 沿方向推開 span 的 0.45 倍。
 */
export function explodedPosition(entry: ExplodeEntry, span: number, factor: number): Vector3 {
  return entry.origin.clone().addScaledVector(entry.dir, span * 0.45 * factor)
}

/** 手動開啟「外牆透視」時外殼的透明度 */
export const SHELL_GHOST_OPACITY = 0.16

/**
 * 機房外殼的透明度。
 *
 * 兩個來源取較透明者：
 * - 爆炸淡出：factor 0 → 全不透明，factor >= 0.6 → 全透明
 * - 手動透視：使用者按下「外牆透視」時固定為 SHELL_GHOST_OPACITY
 */
export function shellOpacityFor(factor: number, ghost = false): number {
  const fade = factor <= 0 ? 1 : Math.max(0, 1 - factor / 0.6)
  return ghost ? Math.min(fade, SHELL_GHOST_OPACITY) : fade
}
