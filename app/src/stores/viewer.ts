import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { GROUP_ORDER, PARTS, type PartDef } from '@/data/parts'

export type PartStatus = 'pending' | 'loading' | 'ready' | 'failed'

export const useViewerStore = defineStore('viewer', () => {
  /** 使用者勾選顯示的構件 */
  const visible = ref(new Set<string>(PARTS.map((p) => p.id)))
  const isolatedId = ref<string | null>(null)
  /** 爆炸係數 0–1 的目標值；實際位移由 render loop 平滑趨近 */
  const explodeFactor = ref(0)
  /** 外牆透視：機房外殼變半透明，與「隱藏外殼」不同——仍看得到牆的位置 */
  const shellGhost = ref(false)
  /** 由甘特圖的進度游標寫入：只顯示已安裝的構件；null 表示不過濾 */
  const progressFilter = ref<Set<string> | null>(null)
  const status = ref<Record<string, PartStatus>>(
    Object.fromEntries(PARTS.map((p) => [p.id, 'pending' as PartStatus])),
  )
  const loadedCount = ref(0)

  const total = PARTS.length
  const allReady = computed(() => loadedCount.value >= total)
  const failed = computed(() => PARTS.filter((p) => status.value[p.id] === 'failed'))

  /** 依 GROUP_ORDER 分組後的清單資料 */
  const groups = computed(() => {
    const byGroup = new Map<string, PartDef[]>()
    for (const p of PARTS) {
      if (!byGroup.has(p.group)) byGroup.set(p.group, [])
      byGroup.get(p.group)!.push(p)
    }
    return GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({
      name: g,
      parts: byGroup.get(g)!,
    }))
  })

  function isVisible(id: string): boolean {
    return visible.value.has(id)
  }

  function setVisible(id: string, on: boolean): void {
    const next = new Set(visible.value)
    if (on) next.add(id)
    else next.delete(id)
    visible.value = next
  }

  function toggleVisible(id: string): void {
    setVisible(id, !isVisible(id))
  }

  function setGroupVisible(group: string, on: boolean): void {
    const next = new Set(visible.value)
    for (const p of PARTS) {
      if (p.group !== group) continue
      if (on) next.add(p.id)
      else next.delete(p.id)
    }
    visible.value = next
  }

  function showAll(): void {
    visible.value = new Set(PARTS.map((p) => p.id))
    isolatedId.value = null
  }

  /** 再點一次同一個構件即取消隔離 */
  function toggleIsolate(id: string): void {
    isolatedId.value = isolatedId.value === id ? null : id
  }

  function setStatus(id: string, s: PartStatus): void {
    status.value = { ...status.value, [id]: s }
  }

  return {
    visible,
    isolatedId,
    explodeFactor,
    shellGhost,
    progressFilter,
    status,
    loadedCount,
    total,
    allReady,
    failed,
    groups,
    isVisible,
    setVisible,
    toggleVisible,
    setGroupVisible,
    showAll,
    toggleIsolate,
    setStatus,
  }
})
