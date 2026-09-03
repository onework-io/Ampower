import {
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  Scene,
} from 'three'

/**
 * 供 PMREM 使用的程序式機房環境。
 *
 * three 內建的 RoomEnvironment 是均勻柔和的攝影棚，金屬在其中只會得到
 * 一片平均的灰——沒有明暗對比就沒有金屬感。這裡改用機房情境：
 * 深色地坪與牆面、天花板數條長形燈槽、單側較亮的開口。
 * 長形燈槽會在圓管與平板上映出細長高光，那才是金屬看起來像金屬的原因。
 *
 * 場景只被 PMREMGenerator 從原點渲染一次，不會加入實際場景中。
 */

/** 發光面：MeshBasicMaterial 的顏色可超過 1，PMREM 會把它當光源 */
function emissive(intensity: number, tint = 0xffffff): MeshBasicMaterial {
  const color = new Color(tint).multiplyScalar(intensity)
  return new MeshBasicMaterial({ color })
}

function box(
  scene: Scene,
  material: MeshStandardMaterial | MeshBasicMaterial,
  size: [number, number, number],
  pos: [number, number, number],
): void {
  const mesh = new Mesh(new BoxGeometry(...size), material)
  mesh.position.set(...pos)
  scene.add(mesh)
}

export function createPlantEnvironment(): Scene {
  const scene = new Scene()

  const W = 14 // 房間寬
  const H = 7 // 房間高
  const D = 14 // 房間深

  // 房間外殼：從內側看的深灰牆面，是金屬暗部反射的來源
  const shell = new MeshStandardMaterial({ color: 0x585f6a, roughness: 1, side: 1 })
  box(scene, shell, [W, H, D], [0, 0, 0])

  // 地坪比牆暗，金屬才會有上亮下暗的方向感；但不能太暗，否則朝下的面全黑
  box(scene, new MeshStandardMaterial({ color: 0x3a3f46, roughness: 1 }), [W, 0.1, D], [0, -H / 2 + 0.05, 0])

  // 天花板整體偏亮，提供基礎環境亮度
  box(scene, new MeshStandardMaterial({ color: 0xc2c9d1, roughness: 1 }), [W, 0.1, D], [0, H / 2 - 0.05, 0])

  // 天花板長形燈槽：金屬上的細長高光靠這幾條
  for (const z of [-4.2, 0, 4.2]) {
    box(scene, emissive(9), [W * 0.75, 0.12, 0.5], [0, H / 2 - 0.35, z])
  }

  // 單側較亮的開口（機房大門／採光），給金屬一個主要的亮面方向
  box(scene, emissive(3.4, 0xbcd4f0), [0.12, H * 0.55, D * 0.42], [-W / 2 + 0.1, -0.4, 0])

  // 對側一小片較弱的補光，避免暗面全黑
  box(scene, emissive(1.4), [0.12, H * 0.35, D * 0.3], [W / 2 - 0.1, 0.2, 0])

  // 近距離點光源讓反射有距離衰減，純面光會顯得過於平均
  const lamp = new PointLight(0xffffff, 28, 0, 2)
  lamp.position.set(0, H / 2 - 1.2, 0)
  scene.add(lamp)

  return scene
}
