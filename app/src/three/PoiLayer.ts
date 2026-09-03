import { Object3D, Vector3 } from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import type { Poi } from '@/data/pois'

/**
 * 3D 場景中的 POI 標記層。
 *
 * 標記以 CSS2DObject 呈現，掛在所屬構件底下——構件被爆炸圖推開、隱藏或因高程修正
 * 位移時，標記自動跟著走，不需要另外同步座標。
 *
 * 卡片本身不在這裡：卡片是 Vue 元件，只用 worldPosition() 取得投影位置。
 * 標記數量可能不少且每幀都要更新，交給 CSS2DRenderer 處理比丟進 Vue 反應式系統划算。
 */

interface Entry {
  poi: Poi
  object: CSS2DObject
  parent: Object3D
}

export class PoiLayer {
  private entries = new Map<string, Entry>()
  private activeId: string | null = null

  constructor(
    /** partId → 構件物件 */
    private parts: Map<string, Object3D>,
    private onSelect: (id: string) => void,
  ) {}

  /** 依最新的 POI 清單建立／更新／移除標記 */
  sync(pois: Poi[]): void {
    const seen = new Set<string>()

    for (const poi of pois) {
      const parent = this.parts.get(poi.partId)
      if (!parent) continue // 構件不存在（例如模型載入失敗）就略過
      seen.add(poi.id)

      const existing = this.entries.get(poi.id)
      if (existing && existing.parent === parent) {
        existing.poi = poi
        existing.object.position.fromArray(poi.position)
        this.applyLabel(existing)
        continue
      }
      if (existing) this.dispose(poi.id)

      const object = new CSS2DObject(this.createElement(poi))
      object.position.fromArray(poi.position)
      object.center.set(0.5, 0.5)
      parent.add(object)
      const entry: Entry = { poi, object, parent }
      this.entries.set(poi.id, entry)
      this.applyLabel(entry)
    }

    for (const id of [...this.entries.keys()]) {
      if (!seen.has(id)) this.dispose(id)
    }
  }

  private createElement(poi: Poi): HTMLElement {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'poi-marker'
    el.style.pointerEvents = 'auto'
    el.addEventListener('pointerdown', (e) => e.stopPropagation()) // 別讓 OrbitControls 吃掉
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      this.onSelect(poi.id)
    })
    return el
  }

  private applyLabel(entry: Entry): void {
    const el = entry.object.element
    el.textContent = entry.poi.title || '未命名'
    el.title = entry.poi.title || '未命名'
    el.classList.toggle('is-active', entry.poi.id === this.activeId)
  }

  setActive(id: string | null): void {
    this.activeId = id
    for (const e of this.entries.values()) {
      e.object.element.classList.toggle('is-active', e.poi.id === id)
    }
  }

  /**
   * 每幀呼叫：讓標記跟著所屬構件一起隱藏。
   * CSS2DRenderer 不看祖先的 visible，只看 CSS2DObject 自己的，所以要手動同步。
   */
  update(): void {
    for (const e of this.entries.values()) {
      e.object.visible = isVisible(e.parent)
    }
  }

  /** 取得某個 POI 的世界座標，供卡片投影定位 */
  worldPosition(id: string, target: Vector3): Vector3 | null {
    const e = this.entries.get(id)
    if (!e || !e.object.visible) return null
    return e.object.getWorldPosition(target)
  }

  private dispose(id: string): void {
    const e = this.entries.get(id)
    if (!e) return
    e.object.removeFromParent()
    e.object.element.remove()
    this.entries.delete(id)
  }

  disposeAll(): void {
    for (const id of [...this.entries.keys()]) this.dispose(id)
  }
}

/** 物件本身與所有祖先都可見才算可見 */
function isVisible(object: Object3D): boolean {
  let o: Object3D | null = object
  while (o) {
    if (!o.visible) return false
    o = o.parent
  }
  return true
}
