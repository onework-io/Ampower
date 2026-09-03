import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Poi } from '@/data/pois'

// 預設清單目前是空的，這裡塞兩筆進去才測得到「使用者變更疊在預設之上」的行為
const DEFAULTS: Poi[] = [
  { id: 'd1', partId: 'p09', position: [0, 0, 0], title: '預設一', url: 'https://youtu.be/aaaaaaaaaaa' },
  { id: 'd2', partId: 'p16', position: [1, 1, 1], title: '預設二', url: '' },
]
vi.mock('@/data/pois', () => ({ DEFAULT_POIS: DEFAULTS }))

const { usePoiStore } = await import('./poi')

describe('POI store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始就是資料檔的預設清單', () => {
    const s = usePoiStore()
    expect(s.pois.map((p) => p.id)).toEqual(['d1', 'd2'])
  })

  it('新增會綁在指定構件並回傳新的 POI', () => {
    const s = usePoiStore()
    const poi = s.add('p06', [1, 2, 3])
    expect(poi.partId).toBe('p06')
    expect(poi.position).toEqual([1, 2, 3])
    expect(s.pois).toHaveLength(3)
  })

  it('新增後直接進入該 POI 的編輯狀態', () => {
    const s = usePoiStore()
    const poi = s.add('p06', [0, 0, 0])
    expect(s.activeId).toBe(poi.id)
    expect(s.editingId).toBe(poi.id)
  })

  it('修改預設項目時以覆寫的方式保留在原位置', () => {
    const s = usePoiStore()
    s.update('d1', { title: '改過的標題' })
    expect(s.pois[0].id).toBe('d1')
    expect(s.pois[0].title).toBe('改過的標題')
    expect(s.pois[0].url).toBe('https://youtu.be/aaaaaaaaaaa') // 未指定的欄位保留
    expect(s.pois).toHaveLength(2)
  })

  it('修改不存在的 id 不會憑空造出項目', () => {
    const s = usePoiStore()
    s.update('nope', { title: 'x' })
    expect(s.pois).toHaveLength(2)
  })

  it('刪除預設項目後不再出現', () => {
    const s = usePoiStore()
    s.remove('d1')
    expect(s.pois.map((p) => p.id)).toEqual(['d2'])
  })

  it('刪除自己新增的項目', () => {
    const s = usePoiStore()
    const poi = s.add('p06', [0, 0, 0])
    s.remove(poi.id)
    expect(s.pois.map((p) => p.id)).toEqual(['d1', 'd2'])
  })

  it('刪除展開中的 POI 會一併關閉卡片與編輯狀態', () => {
    const s = usePoiStore()
    const poi = s.add('p06', [0, 0, 0])
    s.remove(poi.id)
    expect(s.activeId).toBeNull()
    expect(s.editingId).toBeNull()
  })

  it('重設會清掉所有變更，回到預設清單', () => {
    const s = usePoiStore()
    s.add('p06', [0, 0, 0])
    s.update('d1', { title: '改過' })
    s.remove('d2')
    s.resetAll()
    expect(s.pois.map((p) => p.id)).toEqual(['d1', 'd2'])
    expect(s.pois[0].title).toBe('預設一')
  })

  it('依構件統計數量，供清單顯示', () => {
    const s = usePoiStore()
    s.add('p09', [0, 0, 0])
    expect(s.countByPart.get('p09')).toBe(2) // d1 + 新增的
    expect(s.countByPart.get('p16')).toBe(1)
  })

  it('新增的 id 不會重複', () => {
    const s = usePoiStore()
    const ids = new Set(Array.from({ length: 50 }, () => s.add('p09', [0, 0, 0]).id))
    expect(ids.size).toBe(50)
  })
})
