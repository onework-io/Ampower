/**
 * POI（興趣點）：標在 3D 構件表面上的標記，可嵌入 YouTube 影片或其他網址。
 *
 * 這裡是預設清單，使用者在編輯模式新增／修改／刪除的結果存在 localStorage，
 * 疊在這份預設之上。因此日後在這裡新增 POI，使用者端也會出現。
 *
 * position 是「相對於該構件物件」的區域座標，不是世界座標——構件被爆炸圖推開、
 * 或因高程修正而位移時，POI 會跟著走。
 */

export interface Poi {
  id: string
  /** 綁在哪個構件（parts.ts 的 id） */
  partId: string
  /** 構件區域座標 [x, y, z] */
  position: [number, number, number]
  title: string
  /** YouTube／Vimeo 會自動轉成嵌入網址，其他網址一律附「新分頁開啟」 */
  url: string
  /** 播放起點（秒）。未設定時沿用網址自帶的 t= 參數 */
  startSec?: number
  /** 播放終點（秒）。YouTube 才支援；Vimeo 播放器沒有這個參數 */
  endSec?: number
  note?: string
}

/**
 * 預設 POI。目前留空——內容應由實際的施工影片與文件填入，
 * 在編輯模式點模型新增即可，或直接在這裡加：
 *
 * { id: 'poi-rz2000-start', partId: 'p09', position: [0.8, 1.2, -0.4],
 *   title: '啟動程序', url: 'https://youtu.be/xxxxxxxxxxx', note: '含缸套預熱確認' }
 */
export const DEFAULT_POIS: Poi[] = []
