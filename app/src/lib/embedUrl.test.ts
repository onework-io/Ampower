import { describe, expect, it } from 'vitest'
import { toEmbed } from './embedUrl'

describe('YouTube', () => {
  it('watch 網址', () => {
    const r = toEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(r.kind).toBe('youtube')
    expect(r.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
    expect(r.reliable).toBe(true)
  })

  it('youtu.be 短網址', () => {
    expect(toEmbed('https://youtu.be/dQw4w9WgXcQ').embedUrl).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    )
  })

  it('shorts 網址', () => {
    expect(toEmbed('https://www.youtube.com/shorts/dQw4w9WgXcQ').embedUrl).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    )
  })

  it('已經是 embed 網址也能處理', () => {
    expect(toEmbed('https://www.youtube.com/embed/dQw4w9WgXcQ').embedUrl).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    )
  })

  it('沒有 www 也可以', () => {
    expect(toEmbed('https://youtube.com/watch?v=dQw4w9WgXcQ').kind).toBe('youtube')
  })

  it('沒有寫協定會自動補 https', () => {
    expect(toEmbed('youtu.be/dQw4w9WgXcQ').embedUrl).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    )
  })

  it('保留秒數：t=90', () => {
    expect(toEmbed('https://youtu.be/dQw4w9WgXcQ?t=90').embedUrl).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ?start=90',
    )
  })

  it('保留秒數：t=1h2m3s', () => {
    expect(toEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m3s').embedUrl).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ?start=3723',
    )
  })

  it('保留播放清單', () => {
    const r = toEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123')
    expect(r.embedUrl).toContain('list=PL123')
  })

  it('影片 id 長度不對就不當成 YouTube', () => {
    const r = toEmbed('https://www.youtube.com/watch?v=tooshort')
    expect(r.kind).toBe('other')
  })

  it('YouTube 首頁不是影片', () => {
    expect(toEmbed('https://www.youtube.com/').kind).toBe('other')
  })

  it('openUrl 保留使用者原本貼的網址', () => {
    const raw = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90'
    expect(toEmbed(raw).openUrl).toBe(raw)
  })
})

describe('Vimeo', () => {
  it('一般網址', () => {
    expect(toEmbed('https://vimeo.com/123456789').embedUrl).toBe(
      'https://player.vimeo.com/video/123456789',
    )
  })

  it('player 網址', () => {
    expect(toEmbed('https://player.vimeo.com/video/123456789').kind).toBe('vimeo')
  })

  it('非數字 id 不當成 Vimeo', () => {
    expect(toEmbed('https://vimeo.com/channels/staffpicks').kind).toBe('other')
  })
})

describe('其他網址', () => {
  it('標記為不可靠但仍給 embedUrl 與 openUrl', () => {
    const r = toEmbed('https://example.com/manual.pdf')
    expect(r.kind).toBe('other')
    expect(r.reliable).toBe(false)
    expect(r.embedUrl).toBe('https://example.com/manual.pdf')
    expect(r.openUrl).toBe('https://example.com/manual.pdf')
  })

  it('http 也接受', () => {
    expect(toEmbed('http://192.168.1.10/scada').kind).toBe('other')
  })
})

describe('無效輸入', () => {
  it.each(['', '   ', 'javascript:alert(1)', 'data:text/html,<script>', 'not a url at all'])(
    '%s 視為無效',
    (raw) => {
      const r = toEmbed(raw)
      expect(r.kind).toBe('invalid')
      expect(r.embedUrl).toBeNull()
      expect(r.openUrl).toBeNull()
    },
  )
})

describe('播放區間', () => {
  const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

  it('指定起訖會帶進 start 與 end', () => {
    const r = toEmbed(YT, { startSec: 30, endSec: 95 })
    expect(r.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?start=30&end=95')
    expect(r.range).toEqual({ startSec: 30, endSec: 95 })
  })

  it('只指定起點', () => {
    expect(toEmbed(YT, { startSec: 30 }).embedUrl).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ?start=30',
    )
  })

  it('只指定終點', () => {
    expect(toEmbed(YT, { endSec: 95 }).embedUrl).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ?end=95',
    )
  })

  it('明確指定的起點蓋過網址自帶的 t=', () => {
    const r = toEmbed(`${YT}&t=10`, { startSec: 60 })
    expect(r.embedUrl).toContain('start=60')
    expect(r.embedUrl).not.toContain('start=10')
  })

  it('未指定起點時沿用網址的 t=', () => {
    expect(toEmbed(`${YT}&t=10`).range.startSec).toBe(10)
  })

  it('終點早於起點時忽略終點，不產生播不了的網址', () => {
    const r = toEmbed(YT, { startSec: 90, endSec: 30 })
    expect(r.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?start=90')
    expect(r.range.endSec).toBeUndefined()
  })

  it('終點等於起點也忽略', () => {
    expect(toEmbed(YT, { startSec: 30, endSec: 30 }).range.endSec).toBeUndefined()
  })

  it('起點 0 不寫進網址，省得多一個沒有作用的參數', () => {
    expect(toEmbed(YT, { startSec: 0 }).embedUrl).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    )
  })

  it('秒數會取整，YouTube 的參數只吃整數', () => {
    expect(toEmbed(YT, { startSec: 30.7, endSec: 95.2 }).embedUrl).toContain('start=31&end=95')
  })

  it('Vimeo 用 #t= 指定起點，且沒有終點參數', () => {
    const r = toEmbed('https://vimeo.com/123456789', { startSec: 30, endSec: 90 })
    expect(r.embedUrl).toBe('https://player.vimeo.com/video/123456789#t=30s')
    expect(r.range.endSec).toBeUndefined()
  })

  it('一般網址忽略區間', () => {
    const r = toEmbed('https://example.com/doc', { startSec: 30, endSec: 90 })
    expect(r.embedUrl).toBe('https://example.com/doc')
    expect(r.range).toEqual({})
  })
})
