import { Box3, Group, Object3D, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { PARTS, modelUrl, type PartDef } from '@/data/parts'
import { applyMaterialProfiles } from './materials'
import { applyUnitAlignment } from './alignment'

/**
 * 21 個 GLB 共用同一組場域座標，以原點載入即自動組裝。
 * 因此載入後只把「整個 root」平移置中，個別構件維持原座標，
 * 否則相對位置會散掉。
 *
 * 這是與 TaipeiCityHall/ThreeFloorViewer 的 frameModel() 最大差異：
 * 那裡一次只處理一個模型，可以直接對該模型置中。
 */

export interface LoadedPart {
  def: PartDef
  object: Object3D
}

export interface LoadProgress {
  /** 已完成（成功或失敗）的檔案數 */
  done: number
  total: number
  /** 剛完成的構件；失敗時 error 有值 */
  part: PartDef
  error?: unknown
  /** 目前為止成功載入的構件，供載入過程中逐步框景 */
  loaded: LoadedPart[]
}

/**
 * 框景用的包圍盒，以 root 的 local 座標表示：排除地坪。
 *
 * ground.glb 是 170×170 m，會把包圍盒撐大約 7 倍，
 * 相機依此框景會退得太遠，機房變成畫面中的一個小點。
 *
 * 回傳 local 座標而非世界座標，是為了讓 SceneKit.frame() 可以「絕對」設定
 * root.position。若回傳世界座標，載入過程中每次重新框景都會疊加上一次的位移。
 * root 只有位移、沒有旋轉或縮放，因此扣掉 root 的世界位置即為 local 座標。
 */
export function framingBox(loaded: LoadedPart[], root?: Object3D): Box3 {
  const box = new Box3()
  box.makeEmpty()
  for (const { def, object } of loaded) {
    if (def.kind === 'site') continue
    box.union(new Box3().setFromObject(object))
  }
  // 全部都是地坪（或什麼都沒有）時退回完整包圍盒，至少還看得到東西
  if (box.isEmpty()) {
    for (const { object } of loaded) box.union(new Box3().setFromObject(object))
  }
  if (root && !box.isEmpty()) {
    box.translate(root.getWorldPosition(new Vector3()).negate())
  }
  return box
}

/** 把 root 平移，使框景包圍盒中心落在原點 */
export function centerOffset(box: Box3): Vector3 {
  if (box.isEmpty()) return new Vector3()
  return box.getCenter(new Vector3()).negate()
}

/**
 * 依 PARTS 順序（檔案由小到大）逐一載入，邊載邊回報。
 * 單一檔案失敗不阻斷其他檔案。
 */
export async function loadParts(
  root: Group,
  onProgress: (p: LoadProgress) => void,
  parts: PartDef[] = PARTS,
): Promise<LoadedPart[]> {
  // 模型未使用 Draco 壓縮（Blender glTF I/O 直出），不需掛 DRACOLoader
  const loader = new GLTFLoader()
  const loaded: LoadedPart[] = []
  let done = 0

  for (const def of parts) {
    try {
      const gltf = await loader.loadAsync(modelUrl(def.file))
      const object = gltf.scene
      object.name = def.id
      // 高程修正必須在加入 root 之前：root 置中後包圍盒 Z 就不是模型原始座標了
      applyUnitAlignment(object, def.id)
      applyMaterialProfiles(object, def.id)
      object.traverse((o) => {
        if ((o as { isMesh?: boolean }).isMesh) {
          o.castShadow = def.kind !== 'site'
          o.receiveShadow = true
        }
      })
      root.add(object)
      loaded.push({ def, object })
      onProgress({ done: ++done, total: parts.length, part: def, loaded })
    } catch (error) {
      onProgress({ done: ++done, total: parts.length, part: def, error, loaded })
    }
  }

  return loaded
}
