import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

/**
 * 程序式細節貼圖。
 *
 * 模型除了水泥基座之外完全沒有貼圖，金屬表面因此絕對均勻，一看就是 CG。
 * 這裡用 canvas 產生極細微的粗糙度與法線變化打破均勻感，不需要任何外部檔案。
 * 幅度刻意壓得很小——目的是讓高光邊緣有呼吸感，不是要做出鏽蝕或刮痕。
 */

const SIZE = 256

/** 32-bit 整數雜湊，給定座標得到穩定的 0–1 亂數 */
function hash2(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263
  h = (h ^ (h >> 13)) * 1274126177
  return ((h ^ (h >> 16)) >>> 0) / 4294967295
}

const smooth = (t: number) => t * t * (3 - 2 * t)

/** 值雜訊，座標以格數為單位並在邊界環繞，確保貼圖可無縫平鋪 */
function valueNoise(x: number, y: number, period: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = smooth(x - xi)
  const yf = smooth(y - yi)
  const w = (a: number) => ((a % period) + period) % period
  const v00 = hash2(w(xi), w(yi))
  const v10 = hash2(w(xi + 1), w(yi))
  const v01 = hash2(w(xi), w(yi + 1))
  const v11 = hash2(w(xi + 1), w(yi + 1))
  return (v00 * (1 - xf) + v10 * xf) * (1 - yf) + (v01 * (1 - xf) + v11 * xf) * yf
}

/** 多層疊加的高度場；stretchX 用來做拉絲金屬的方向性條紋 */
function heightField(stretchX: number): Float32Array {
  const h = new Float32Array(SIZE * SIZE)
  const octaves = [
    { period: 8, amp: 0.55 },
    { period: 16, amp: 0.3 },
    { period: 64, amp: 0.15 },
  ]
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let v = 0
      for (const o of octaves) {
        const px = Math.max(1, Math.round(o.period * stretchX))
        v += o.amp * valueNoise((x / SIZE) * px, (y / SIZE) * o.period, o.period)
      }
      h[y * SIZE + x] = v
    }
  }
  return h
}

function makeTexture(draw: (data: Uint8ClampedArray) => void, srgb: boolean): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(SIZE, SIZE)
  draw(img.data)
  ctx.putImageData(img, 0, 0)
  const tex = new CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = RepeatWrapping
  if (srgb) tex.colorSpace = SRGBColorSpace
  return tex
}

/** roughnessMap 會乘上材質的 roughness，故取值集中在 0.82–1.0 之間只做輕微變化 */
function roughnessTexture(h: Float32Array): Texture {
  return makeTexture((data) => {
    for (let i = 0; i < SIZE * SIZE; i++) {
      const v = Math.round((0.82 + 0.18 * h[i]) * 255)
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v
      data[i * 4 + 3] = 255
    }
  }, false)
}

/** 由高度場的 Sobel 梯度算切線空間法線 */
function normalTexture(h: Float32Array, strength: number): Texture {
  const at = (x: number, y: number) => h[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)]
  return makeTexture((data) => {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const dx = at(x + 1, y) - at(x - 1, y)
        const dy = at(x, y + 1) - at(x, y - 1)
        const nx = -dx * strength
        const ny = -dy * strength
        const len = Math.hypot(nx, ny, 1)
        const i = (y * SIZE + x) * 4
        data[i] = Math.round(((nx / len) * 0.5 + 0.5) * 255)
        data[i + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255)
        data[i + 2] = Math.round((1 / len) * 0.5 * 255 + 127.5)
        data[i + 3] = 255
      }
    }
  }, false)
}

export interface DetailMaps {
  roughnessMap: Texture
  normalMap: Texture
}

const base = new Map<string, DetailMaps>()
const cache = new Map<string, DetailMaps>()

function baseMaps(kind: 'metal' | 'brushed'): DetailMaps {
  const hit = base.get(kind)
  if (hit) return hit
  const h = heightField(kind === 'brushed' ? 8 : 1)
  const maps = {
    roughnessMap: roughnessTexture(h),
    normalMap: normalTexture(h, kind === 'brushed' ? 14 : 8),
  }
  base.set(kind, maps)
  return maps
}

/**
 * 取得細節貼圖組。
 * `metal` 為等向的細微起伏，`brushed` 為沿 U 方向拉長的條紋（拉絲不鏽鋼）。
 *
 * repeat 存在 Texture 而非 Material 上，所以不同平鋪次數必須各自持有貼圖實例，
 * 否則最後套用的那個會蓋掉其他材質。同一組合只建立一次並快取。
 */
export function detailMaps(kind: 'metal' | 'brushed', repeat: number): DetailMaps | null {
  // 貼圖以 canvas 產生；非瀏覽器環境（例如單元測試）不產生，材質參數照樣生效
  if (typeof document === 'undefined') return null

  const key = `${kind}:${repeat}`
  const hit = cache.get(key)
  if (hit) return hit

  const src = baseMaps(kind)
  const roughnessMap = src.roughnessMap.clone()
  const normalMap = src.normalMap.clone()
  for (const t of [roughnessMap, normalMap]) {
    t.repeat.set(repeat, repeat)
    t.needsUpdate = true
  }
  const maps = { roughnessMap, normalMap }
  cache.set(key, maps)
  return maps
}

export function disposeDetailMaps(): void {
  for (const m of [...cache.values(), ...base.values()]) {
    m.roughnessMap.dispose()
    m.normalMap.dispose()
  }
  cache.clear()
  base.clear()
}
