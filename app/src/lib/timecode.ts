/**
 * 影片時間碼的解析與格式化。
 *
 * 接受的輸入形式：
 *   90        → 90 秒
 *   1:30      → 90 秒
 *   1:02:03   → 3723 秒
 *   1h2m3s    → 3723 秒（YouTube 網址的 t= 參數格式）
 *   2m        → 120 秒
 */

/** 解析時間碼；無法解析或為負值回傳 null */
export function parseTimecode(raw: string): number | null {
  const s = raw.trim().toLowerCase()
  if (!s) return null

  // 純秒數
  if (/^\d+$/.test(s)) return Number(s)

  // h:mm:ss / m:ss
  if (/^\d{1,3}(:[0-5]?\d){1,2}$/.test(s)) {
    const parts = s.split(':').map(Number)
    return parts.reduce((acc, n) => acc * 60 + n, 0)
  }

  // 1h2m3s，各段皆可省略但至少要有一段
  const m = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
  if (m && (m[1] || m[2] || m[3])) {
    return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
  }

  return null
}

/** 秒數轉 m:ss（超過一小時轉 h:mm:ss） */
export function formatTimecode(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** 區間是否合法：結束必須晚於開始 */
export function isValidRange(startSec?: number, endSec?: number): boolean {
  if (startSec === undefined || endSec === undefined) return true
  return endSec > startSec
}
