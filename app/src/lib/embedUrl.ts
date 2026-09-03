/**
 * 把使用者輸入的網址轉成可嵌入的網址。
 *
 * 多數網站會用 X-Frame-Options 或 CSP frame-ancestors 拒絕被 iframe 嵌入，
 * 而且瀏覽器不會回報錯誤，只會顯示一片空白。因此除了影音平台之外，
 * 一律同時提供「在新分頁開啟」的退路。
 */

import { parseTimecode } from './timecode'

export type EmbedKind = 'youtube' | 'vimeo' | 'other' | 'invalid'

/** 播放區間（秒）。只有影音平台支援，一般網址會忽略 */
export interface TimeRange {
  startSec?: number
  endSec?: number
}

export interface EmbedInfo {
  kind: EmbedKind
  /** 可放進 iframe 的網址；invalid 時為 null */
  embedUrl: string | null
  /** 在新分頁開啟用的原始網址；invalid 時為 null */
  openUrl: string | null
  /** 是否確定可嵌入。false 代表可能被對方網站擋掉 */
  reliable: boolean
  /** 實際套用的播放區間，供介面顯示 */
  range: TimeRange
}

/** YouTube 影片 id 為 11 碼的 base64url 字元 */
const YT_ID = /^[\w-]{11}$/

function parse(raw: string): URL | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    // 沒寫協定的一律補 https，使用者通常只貼 youtu.be/xxx
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
}

const isHost = (url: URL, ...hosts: string[]) => {
  const h = url.hostname.replace(/^www\./, '').toLowerCase()
  return hosts.includes(h)
}

/** 取出 YouTube 影片 id，支援 watch / youtu.be / shorts / embed / live 各種形式 */
function youtubeId(url: URL): string | null {
  if (isHost(url, 'youtu.be')) {
    const id = url.pathname.slice(1).split('/')[0]
    return YT_ID.test(id) ? id : null
  }
  if (!isHost(url, 'youtube.com', 'm.youtube.com', 'youtube-nocookie.com')) return null

  const v = url.searchParams.get('v')
  if (v && YT_ID.test(v)) return v

  const seg = url.pathname.split('/').filter(Boolean)
  if (seg.length >= 2 && ['shorts', 'embed', 'live', 'v'].includes(seg[0])) {
    return YT_ID.test(seg[1]) ? seg[1] : null
  }
  return null
}

/** 取出 Vimeo 影片 id（純數字） */
function vimeoId(url: URL): string | null {
  if (isHost(url, 'vimeo.com', 'player.vimeo.com')) {
    const seg = url.pathname.split('/').filter(Boolean)
    const id = seg[0] === 'video' ? seg[1] : seg[0]
    return id && /^\d+$/.test(id) ? id : null
  }
  return null
}

/** 從網址的 t / start 參數取出起始秒數，作為未指定區間時的預設 */
export function startFromUrl(raw: string): number | null {
  const url = parse(raw)
  if (!url) return null
  const t = url.searchParams.get('t') ?? url.searchParams.get('start')
  if (!t) return null
  const secs = parseTimecode(t)
  return secs !== null && secs > 0 ? secs : null
}

const INVALID: EmbedInfo = {
  kind: 'invalid',
  embedUrl: null,
  openUrl: null,
  reliable: false,
  range: {},
}

/**
 * @param range 明確指定的播放區間。未指定 startSec 時，沿用網址自帶的 t= 參數。
 *              結束早於或等於開始的區間會被忽略，避免產生播不了的嵌入網址。
 */
export function toEmbed(raw: string, range: TimeRange = {}): EmbedInfo {
  const url = parse(raw)
  if (!url) return INVALID

  // 只允許 http(s)，擋掉 javascript: 這類協定
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return INVALID

  const start = range.startSec ?? startFromUrl(raw) ?? undefined
  const end = range.endSec !== undefined && (start === undefined || range.endSec > start)
    ? range.endSec
    : undefined
  const applied: TimeRange = { startSec: start, endSec: end }

  const yt = youtubeId(url)
  if (yt) {
    const embed = new URL(`https://www.youtube.com/embed/${yt}`)
    if (start !== undefined && start > 0) embed.searchParams.set('start', String(Math.round(start)))
    if (end !== undefined) embed.searchParams.set('end', String(Math.round(end)))
    const list = url.searchParams.get('list')
    if (list) embed.searchParams.set('list', list)
    return {
      kind: 'youtube',
      embedUrl: embed.toString(),
      openUrl: url.toString(),
      reliable: true,
      range: applied,
    }
  }

  const vm = vimeoId(url)
  if (vm) {
    // Vimeo 用 #t=90s 指定起點，播放器沒有結束參數
    const hash = start !== undefined && start > 0 ? `#t=${Math.round(start)}s` : ''
    return {
      kind: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vm}${hash}`,
      openUrl: url.toString(),
      reliable: true,
      range: { startSec: start },
    }
  }

  // 其他網址：仍然試著嵌入，但標記為不可靠，介面上一定要有新分頁按鈕
  return {
    kind: 'other',
    embedUrl: url.toString(),
    openUrl: url.toString(),
    reliable: false,
    range: {},
  }
}
