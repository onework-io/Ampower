import {
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from 'three'

/**
 * 科技風格線地坪，用來取代 ground.glb 的淺灰平面。
 *
 * 兩層構成：
 *   1. 受影平面 —— 深色 MeshStandardMaterial，負責接住建物的陰影。
 *      格線那層是自訂 shader，要讓它接陰影得自己實作 shadow map 取樣，
 *      不划算，因此陰影交給底下這層。
 *   2. 格線 —— ShaderMaterial，以 fwidth（螢幕空間導數）做抗鋸齒，
 *      線寬因此不隨距離變粗，遠處再徑向淡出融進背景。
 */

export interface TechGridOptions {
  /** 平面邊長（公尺） */
  size: number
  /** 格線中心（模型座標） */
  center: Vector3
  /** 細格間距（公尺） */
  minor: number
  /** 粗格間距（公尺） */
  major: number
  /** 開始淡出的半徑 */
  fadeStart: number
  /** 完全淡出的半徑 */
  fadeEnd: number
  color: string
  majorColor: string
  /** 底層受影平面的顏色 */
  baseColor: string
}

/**
 * 預設為淺色產品展示風：淺灰地坪配藍紫色格線，往遠處淡出。
 * 格線密度刻意接近單一層級，粗格只做很輕微的層次，避免出現明顯的方格區塊感。
 */
export const DEFAULT_TECH_GRID: TechGridOptions = {
  size: 600,
  center: new Vector3(0, 0, 0),
  minor: 2,
  major: 10,
  fadeStart: 30,
  fadeEnd: 200,
  // 自訂 shader 的輸出會一起走 EffectComposer 的 ACES 色調映射（曝光 0.85），
  // 顏色會被壓暗、彩度降低，因此這裡刻意取比目標更飽和的值來補償。
  color: '#4f63e8',
  majorColor: '#3a4fdd',
  baseColor: '#e6e8ec',
}

const VERT = /* glsl */ `
  varying vec2 vGrid;
  varying vec2 vCenter;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vGrid = world.xz;
    // 淡出中心取平面自身的世界原點。
    // 用 uniform 從外面傳座標很容易搞錯座標系——場景 root 會為了置中而位移，
    // 模型座標與世界座標相差那個位移量，傳錯就會整片被淡出成透明。
    vCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const FRAG = /* glsl */ `
  precision highp float;

  varying vec2 vGrid;
  varying vec2 vCenter;

  uniform float uMinor;
  uniform float uMajor;
  uniform vec3 uColor;
  uniform vec3 uMajorColor;
  uniform float uFadeStart;
  uniform float uFadeEnd;
  uniform float uOpacity;

  /**
   * 一組格線的覆蓋率。
   * 以 fwidth 取得該像素涵蓋的世界距離，把線寬換算成固定的螢幕像素數，
   * 遠處的線才不會糊成一片、近處也不會變成粗帶。
   */
  float grid(vec2 p, float spacing, float widthPx) {
    vec2 toLine = abs(fract(p / spacing - 0.5) - 0.5) * spacing;
    vec2 texel = fwidth(p);
    vec2 inPixels = toLine / max(texel, vec2(1e-6));
    return 1.0 - smoothstep(0.0, widthPx, min(inPixels.x, inPixels.y));
  }

  void main() {
    float minorLine = grid(vGrid, uMinor, 1.1);
    float majorLine = grid(vGrid, uMajor, 1.5);

    // 徑向淡出：遠處溶進背景，避免出現平面的硬邊
    float dist = length(vGrid - vCenter);
    float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, dist);

    vec3 color = mix(uColor, uMajorColor, majorLine);
    float alpha = max(minorLine * 0.78, majorLine * 1.0) * fade * uOpacity;
    if (alpha < 0.002) discard;

    gl_FragColor = vec4(color, alpha);
  }
`

export interface TechGrid {
  group: Group
  dispose(): void
}

/**
 * 建立格線地坪。
 * @param y 地坪高程（模型座標）
 */
export function createTechGrid(y: number, options: Partial<TechGridOptions> = {}): TechGrid {
  const opt = { ...DEFAULT_TECH_GRID, ...options }
  const group = new Group()
  group.name = 'tech-grid-floor'

  const geometry = new PlaneGeometry(opt.size, opt.size)

  const baseMaterial = new MeshStandardMaterial({
    color: new Color(opt.baseColor),
    roughness: 1,
    metalness: 0,
  })
  const base = new Mesh(geometry, baseMaterial)
  base.rotation.x = -Math.PI / 2
  base.position.set(opt.center.x, y, opt.center.z)
  base.receiveShadow = true
  group.add(base)

  const gridMaterial = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      uMinor: { value: opt.minor },
      uMajor: { value: opt.major },
      uColor: { value: new Color(opt.color) },
      uMajorColor: { value: new Color(opt.majorColor) },
      uFadeStart: { value: opt.fadeStart },
      uFadeEnd: { value: opt.fadeEnd },
      uOpacity: { value: 1 },
    },
  })
  const lines = new Mesh(geometry, gridMaterial)
  lines.rotation.x = -Math.PI / 2
  // 抬高 1 公釐避免與底層 z-fighting
  lines.position.set(opt.center.x, y + 0.001, opt.center.z)
  lines.renderOrder = 1
  group.add(lines)

  return {
    group,
    dispose() {
      geometry.dispose()
      baseMaterial.dispose()
      gridMaterial.dispose()
      group.removeFromParent()
    },
  }
}
