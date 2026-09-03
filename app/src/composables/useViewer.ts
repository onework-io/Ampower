import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { Group, Object3D, Vector3 } from 'three'
import { SceneKit } from '@/three/SceneKit'
import { PartRegistry } from '@/three/PartRegistry'
import { framingBox, loadParts, type LoadedPart } from '@/three/ModelLoader'
import { PARTS } from '@/data/parts'
import { useViewerStore } from '@/stores/viewer'
import { usePoiStore } from '@/stores/poi'
import { PoiLayer } from '@/three/PoiLayer'

/** 爆炸係數每幀趨近目標值的比例，讓拖曳滑桿時是滑順的而非跳動 */
const EASE = 0.15

/**
 * 把 SceneKit / PartRegistry 綁到 Vue 生命週期，並把 store 狀態同步進 3D 場景。
 */
export function useViewer(host: Ref<HTMLElement | null>) {
  const store = useViewerStore()
  const poiStore = usePoiStore()
  const fatal = ref<string | null>(null)
  /** 展開中的 POI 卡片要釘在畫布上的哪個像素位置；不可見時為 null */
  const activePoiScreen = ref<{ x: number; y: number } | null>(null)

  let kit: SceneKit | null = null
  let registry: PartRegistry | null = null
  let poiLayer: PoiLayer | null = null
  let currentFactor = 0
  const scratch = new Vector3()

  async function boot() {
    try {
      kit = new SceneKit(host.value!)
    } catch (e) {
      fatal.value = `無法建立 WebGL 場景：${e instanceof Error ? e.message : String(e)}`
      return
    }

    const loaded: LoadedPart[] = await loadParts(kit.root as Group, (p) => {
      store.setStatus(p.part.id, p.error ? 'failed' : 'ready')
      store.loadedCount = p.done
      if (p.error) console.error(`載入失敗：${p.part.file}`, p.error)
      // 邊載邊框景，畫面不會等到最後才動
      if (kit) {
        kit.root.updateMatrixWorld(true)
        kit.frame(framingBox(p.loaded, kit.root))
      }
    })

    if (!kit) return
    if (loaded.length === 0) {
      fatal.value = '所有模型都載入失敗，請確認 public/models 指向 3D/ 資料夾。'
      return
    }

    kit.root.updateMatrixWorld(true)
    kit.frame(framingBox(loaded, kit.root))
    kit.root.updateMatrixWorld(true)
    registry = new PartRegistry(loaded)
    applyAll()

    const partObjects = new Map<string, Object3D>(loaded.map((l) => [l.def.id, l.object]))
    poiLayer = new PoiLayer(partObjects, (id) => {
      poiStore.activeId = id
    })
    poiLayer.sync(poiStore.pois)

    kit.setFrameCallback(() => {
      poiLayer?.update()
      updateActivePoiScreen()

      const target = store.explodeFactor
      if (Math.abs(currentFactor - target) > 0.0005) {
        currentFactor += (target - currentFactor) * EASE
        registry?.setExplodeFactor(currentFactor)
      } else if (currentFactor !== target) {
        currentFactor = target
        registry?.setExplodeFactor(currentFactor)
      }
    })
  }

  function applyAll() {
    if (!registry) return
    for (const p of PARTS) registry.setVisible(p.id, store.isVisible(p.id))
    registry.setIsolated(store.isolatedId)
    registry.setShellGhost(store.shellGhost)
    registry.setProgressFilter(store.progressFilter)
  }

  /** 每幀更新卡片位置，讓它跟著 3D 點走 */
  function updateActivePoiScreen() {
    const id = poiStore.activeId
    if (!id || !kit || !poiLayer) {
      if (activePoiScreen.value !== null) activePoiScreen.value = null
      return
    }
    const world = poiLayer.worldPosition(id, scratch)
    const next = world ? kit.project(world) : null
    const prev = activePoiScreen.value
    // 只在真的移動時寫入，避免每幀觸發 Vue 更新
    if (!next) {
      if (prev !== null) activePoiScreen.value = null
      return
    }
    if (!prev || Math.abs(prev.x - next.x) > 0.5 || Math.abs(prev.y - next.y) > 0.5) {
      activePoiScreen.value = next
    }
  }

  function resetView() {
    kit?.resetView()
  }

  /**
   * 在模型表面新增 POI。
   * 命中點是世界座標，要轉成所屬構件的區域座標，POI 才會跟著構件移動。
   */
  function placePoiAt(clientX: number, clientY: number): boolean {
    if (!kit) return false
    const hit = kit.pick(clientX, clientY)
    if (!hit) return false

    // 由命中的 mesh 往上找到構件根節點（loadParts 已把 object.name 設為 partId）
    let node: Object3D | null = hit.object
    while (node && !PARTS.some((p) => p.id === node!.name)) node = node.parent
    if (!node) return false

    const local = node.worldToLocal(hit.point.clone())
    poiStore.add(node.name, [local.x, local.y, local.z])
    return true
  }

  onMounted(boot)

  watch(
    () => store.visible,
    () => {
      if (!registry) return
      for (const p of PARTS) registry.setVisible(p.id, store.isVisible(p.id))
    },
    { deep: true },
  )

  watch(
    () => store.isolatedId,
    (id) => registry?.setIsolated(id),
  )

  watch(
    () => store.shellGhost,
    (on) => registry?.setShellGhost(on),
  )

  watch(
    () => store.progressFilter,
    (ids) => registry?.setProgressFilter(ids),
  )

  watch(
    () => poiStore.pois,
    (list) => poiLayer?.sync(list),
    { deep: true },
  )

  watch(
    () => poiStore.activeId,
    (id) => {
      poiLayer?.setActive(id)
      updateActivePoiScreen()
    },
  )

  onBeforeUnmount(() => {
    kit?.setFrameCallback(null)
    poiLayer?.disposeAll()
    poiLayer = null
    registry?.dispose()
    kit?.dispose()
    kit = null
    registry = null
  })

  return { fatal, resetView, placePoiAt, activePoiScreen }
}
