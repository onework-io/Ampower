import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import { createPlantEnvironment } from './plantEnvironment'

/**
 * three.js 場景骨架：renderer / camera / controls / 光照 / 後製 / resize / dispose。
 * 不依賴 Vue，可獨立使用與釋放。
 *
 * 渲染設定沿用 TaipeiCityHall/scada-vue 的 ThreeFloorViewer：
 * ACESFilmic 色調映射、PCFSoft 陰影、RoomEnvironment PMREM 環境光、SSAO 後製。
 */
/** 預設觀看方向（單位向量）：右前上方的四分之三視角 */
const DEFAULT_DIR = new THREE.Vector3(0.75, 0.55, 0.75).normalize()

export class SceneKit {
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  readonly controls: OrbitControls
  readonly root = new THREE.Group()

  /** POI 標記層：HTML 疊在 canvas 之上，字不會糊也不隨距離縮放 */
  readonly labelRenderer = new CSS2DRenderer()

  private raycaster = new THREE.Raycaster()
  private composer: EffectComposer
  private ssaoPass: SSAOPass
  private dirLight: THREE.DirectionalLight
  private pmrem: THREE.PMREMGenerator
  private envTex: THREE.Texture
  private raf = 0
  /** 使用者是否已用滑鼠操作過相機；操作後 resize 就不再自動重新框景 */
  private userMoved = false
  private ro: ResizeObserver
  private onFrame: (() => void) | null = null

  constructor(private host: HTMLElement) {
    const w = Math.max(host.clientWidth, 1)
    const h = Math.max(host.clientHeight, 1)

    this.scene.background = new THREE.Color(0x0e1626)
    this.scene.add(this.root)

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 5000)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.85
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    host.appendChild(this.renderer.domElement)

    this.labelRenderer.setSize(w, h)
    const labelEl = this.labelRenderer.domElement
    labelEl.style.position = 'absolute'
    labelEl.style.inset = '0'
    labelEl.style.pointerEvents = 'none' // 個別標記自己開 pointer-events
    host.appendChild(labelEl)

    // IBL：金屬的立體感幾乎全來自環境反射，環境貼圖的明暗對比比燈光更關鍵
    this.pmrem = new THREE.PMREMGenerator(this.renderer)
    const env = createPlantEnvironment()
    this.envTex = this.pmrem.fromScene(env, 0.02).texture
    env.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) mesh.geometry.dispose()
    })
    this.scene.environment = this.envTex
    this.scene.environmentIntensity = 1.05

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.08))
    this.dirLight = new THREE.DirectionalLight(0xffffff, 2.2)
    this.dirLight.castShadow = true
    this.dirLight.shadow.mapSize.setScalar(2048)
    this.dirLight.shadow.bias = -0.0004
    this.dirLight.shadow.normalBias = 0.02
    this.scene.add(this.dirLight, this.dirLight.target)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.addEventListener('start', () => {
      this.userMoved = true
    })

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.ssaoPass = new SSAOPass(this.scene, this.camera, w, h)
    this.ssaoPass.kernelRadius = 16
    this.ssaoPass.minDistance = 0.0015
    this.ssaoPass.maxDistance = 0.12
    this.composer.addPass(this.ssaoPass)
    this.composer.addPass(new OutputPass())

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(host)

    this.tick()
  }

  /** 每幀回呼，供爆炸動畫等外部狀態插值 */
  setFrameCallback(fn: (() => void) | null): void {
    this.onFrame = fn
  }

  private tick = (): void => {
    this.raf = requestAnimationFrame(this.tick)
    this.onFrame?.()
    this.controls.update()
    this.composer.render()
    this.labelRenderer.render(this.scene, this.camera)
  }

  private resize(): void {
    const w = Math.max(this.host.clientWidth, 1)
    const h = Math.max(this.host.clientHeight, 1)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.composer.setSize(w, h)
    this.ssaoPass.setSize(w, h)
    this.labelRenderer.setSize(w, h)

    // 框景距離是依 aspect 算的，視窗變窄後模型會被裁掉。
    // 使用者還沒動過相機時就重新框景；動過之後尊重他的視角，交給「重設視角」處理。
    if (!this.userMoved && this.framingBox) this.frame(this.framingBox)
  }

  /** 最近一次 frame() 使用的框景包圍盒，供 resetView 重用 */
  private framingBox: THREE.Box3 | null = null

  /**
   * 依包圍盒把 root 置中、擺好相機與方向光。
   * box 應為排除地坪後的框景包圍盒（見 ModelLoader.framingBox），座標為 root 內的 local 座標。
   */
  frame(box: THREE.Box3): void {
    if (box.isEmpty()) return
    this.framingBox = box.clone()
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    // 絕對指定而非累加，重複呼叫 frame() 不會把模型愈推愈遠
    this.root.position.copy(center).negate()

    const span = size.length() || 20

    // Fit-to-bounds：分別算出水平與垂直方向所需的距離再取大者。
    // 直接用包圍盒對角線當半徑會把相機推得太遠（對角線是最壞情況的角落距離），
    // 機房這種扁長體會縮成畫面中的一小塊。
    const halfV = THREE.MathUtils.degToRad(this.camera.fov) / 2
    const halfH = Math.atan(Math.tan(halfV) * this.camera.aspect)
    const halfWidth = Math.hypot(size.x, size.z) / 2 // 水平任意繞轉時的最大半寬
    const halfHeight = size.y / 2
    const dist =
      Math.max(halfWidth / Math.tan(halfH), halfHeight / Math.tan(halfV), span * 0.05) * 1.25

    this.camera.near = span / 1000
    this.camera.far = span * 20
    this.camera.position.copy(DEFAULT_DIR).multiplyScalar(dist)
    this.camera.updateProjectionMatrix()

    this.controls.target.set(0, 0, 0)
    this.controls.minDistance = span * 0.05
    this.controls.maxDistance = span * 6
    this.controls.update()

    // 陰影相機依模型尺度配置，太小會截掉陰影、太大會讓陰影糊掉
    this.dirLight.position.set(span * 0.6, span * 0.9, span * 0.45)
    this.dirLight.target.position.set(0, 0, 0)
    this.dirLight.target.updateMatrixWorld()
    const cam = this.dirLight.shadow.camera
    cam.left = -span * 0.7
    cam.right = span * 0.7
    cam.top = span * 0.7
    cam.bottom = -span * 0.7
    cam.near = span * 0.05
    cam.far = span * 3
    cam.updateProjectionMatrix()

    this.ssaoPass.minDistance = Math.max(span * 0.00005, 0.0005)
    this.ssaoPass.maxDistance = span * 0.01
  }

  /** 相機回到預設視角 */
  resetView(): void {
    if (this.framingBox) this.frame(this.framingBox)
  }

  /**
   * 以畫布座標對模型做射線拾取。
   * @returns 命中的世界座標與命中的物件；沒打到回 null
   */
  pick(clientX: number, clientY: number): { point: THREE.Vector3; object: THREE.Object3D } | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(ndc, this.camera)
    // 只打可見的物件；隱藏的構件不該被點到
    const hits = this.raycaster.intersectObject(this.root, true).filter((h) => {
      let o: THREE.Object3D | null = h.object
      while (o) {
        if (!o.visible) return false
        o = o.parent
      }
      return true
    })
    if (!hits.length) return null
    return { point: hits[0].point.clone(), object: hits[0].object }
  }

  /** 世界座標投影到畫布像素座標；在相機背後回 null */
  project(world: THREE.Vector3): { x: number; y: number } | null {
    const v = world.clone().project(this.camera)
    if (v.z > 1) return null
    const el = this.renderer.domElement
    return { x: ((v.x + 1) / 2) * el.clientWidth, y: ((1 - v.y) / 2) * el.clientHeight }
  }

  dispose(): void {
    cancelAnimationFrame(this.raf)
    this.labelRenderer.domElement.remove()
    this.ro.disconnect()
    this.controls.dispose()
    this.composer.dispose()
    this.envTex.dispose()
    this.pmrem.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
