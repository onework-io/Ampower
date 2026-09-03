import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { DEFAULT_POIS, type Poi } from '@/data/pois'

const STORAGE_KEY = 'generator-pois-v1'

interface Persisted {
  /** 使用者新增的，以及對預設項目的修改（以完整內容覆寫） */
  custom: Record<string, Poi>
  /** 被刪掉的預設項目 id */
  removed: string[]
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const p = raw ? (JSON.parse(raw) as Persisted) : null
    return { custom: p?.custom ?? {}, removed: p?.removed ?? [] }
  } catch {
    return { custom: {}, removed: [] }
  }
}

export const usePoiStore = defineStore('poi', () => {
  const saved = load()
  const custom = ref<Record<string, Poi>>(saved.custom)
  const removed = ref<string[]>(saved.removed)

  /** 編輯模式：點模型表面即新增 POI */
  const editMode = ref(false)
  /** 目前展開卡片的 POI */
  const activeId = ref<string | null>(null)
  /** 正在編輯欄位的 POI（新增後直接進入編輯） */
  const editingId = ref<string | null>(null)

  const pois = computed<Poi[]>(() => {
    const out: Poi[] = []
    for (const d of DEFAULT_POIS) {
      if (removed.value.includes(d.id)) continue
      out.push(custom.value[d.id] ?? d)
    }
    const defaultIds = new Set(DEFAULT_POIS.map((d) => d.id))
    for (const [id, p] of Object.entries(custom.value)) {
      if (!defaultIds.has(id)) out.push(p)
    }
    return out
  })

  const byId = computed(() => new Map(pois.value.map((p) => [p.id, p])))

  const countByPart = computed(() => {
    const m = new Map<string, number>()
    for (const p of pois.value) m.set(p.partId, (m.get(p.partId) ?? 0) + 1)
    return m
  })

  function add(partId: string, position: [number, number, number]): Poi {
    const poi: Poi = {
      id: `poi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      partId,
      position,
      title: '新標記',
      url: '',
    }
    custom.value = { ...custom.value, [poi.id]: poi }
    activeId.value = poi.id
    editingId.value = poi.id
    return poi
  }

  function update(id: string, patch: Partial<Poi>): void {
    const base = byId.value.get(id)
    if (!base) return
    custom.value = { ...custom.value, [id]: { ...base, ...patch, id } }
  }

  function remove(id: string): void {
    const { [id]: _dropped, ...rest } = custom.value
    custom.value = rest
    if (DEFAULT_POIS.some((d) => d.id === id) && !removed.value.includes(id)) {
      removed.value = [...removed.value, id]
    }
    if (activeId.value === id) activeId.value = null
    if (editingId.value === id) editingId.value = null
  }

  /** 清掉所有使用者變更，回到資料檔的預設清單 */
  function resetAll(): void {
    custom.value = {}
    removed.value = []
    activeId.value = null
    editingId.value = null
  }

  watch(
    [custom, removed],
    () => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ custom: custom.value, removed: removed.value } satisfies Persisted),
        )
      } catch {
        // 存不了不影響操作，只是重整後不保留
      }
    },
    { deep: true },
  )

  return {
    pois,
    byId,
    countByPart,
    editMode,
    activeId,
    editingId,
    add,
    update,
    remove,
    resetAll,
  }
})
