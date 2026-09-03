import { CanvasTexture, LinearFilter, SRGBColorSpace, type Texture } from 'three'

/**
 * 背景漸層。
 *
 * three 允許把一般貼圖指定給 scene.background，會被拉伸鋪滿整個畫面，
 * 因此只需要一張 1 像素寬的直向漸層即可。
 */
export function createBackdrop(top = '#e2e4e8', bottom = '#c8cbd2'): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, 256)
  g.addColorStop(0, top)
  g.addColorStop(1, bottom)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 1, 256)

  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.minFilter = LinearFilter
  tex.magFilter = LinearFilter
  return tex
}
