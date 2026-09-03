import { Box3, Object3D } from 'three'
import { UNIT_SPLIT_Z, UNIT_Y_OFFSET } from '@/data/alignment'

/** 判定「橫跨兩台」的容差（公尺）：兩側都超出這個距離才算共用構件 */
const SPAN_TOLERANCE = 0.5

/**
 * 把構件中屬於右側機組的那一份沿 Y 位移，對齊左側那一份。
 *
 * 必須在物件加入場景 root 之前呼叫：root 置中後會帶著位移，
 * 那時算出來的包圍盒 Z 已不是模型原始座標，分界判斷就會失效。
 *
 * @returns 實際被位移的頂層節點數，供測試與除錯確認
 */
export function applyUnitAlignment(object: Object3D, partId: string): number {
  const dy = UNIT_Y_OFFSET[partId]
  if (dy === undefined || dy === 0) return 0

  object.updateMatrixWorld(true)

  let moved = 0
  for (const child of object.children) {
    const box = new Box3().setFromObject(child)
    if (box.isEmpty()) continue

    // 兩側都明顯跨到的節點是兩台共用的整塊構件（例如共用基座板），整塊抬起會更錯
    const spansBoth =
      box.min.z < UNIT_SPLIT_Z - SPAN_TOLERANCE && box.max.z > UNIT_SPLIT_Z + SPAN_TOLERANCE
    if (spansBoth) continue

    if ((box.min.z + box.max.z) / 2 < UNIT_SPLIT_Z) {
      child.position.y += dy
      moved++
    }
  }

  object.updateMatrixWorld(true)
  return moved
}
