#!/usr/bin/env bash
# 把 3D/ 的原始 GLB 壓縮後輸出到 3D-draco/，供網頁載入。
#
# 原始檔保留不動——Draco 對位置與法線是有損量化、貼圖也被降尺寸，
# 原始模型仍是交付與再編修的依據。app/public/models 指向 3D-draco/。
#
# 三個步驟，刻意分開執行而不用 `optimize`：
#   resize  貼圖降到 1024（三個大檔嵌了同一組 2048² 混凝土貼圖，體積幾乎都在這裡）
#   webp    貼圖轉 WebP，three 的 GLTFLoader 原生支援 EXT_texture_webp
#   draco   幾何壓縮
#
# 不用 `optimize` 是因為它會順便做 join / instance 之類的場景圖重組，
# 那會破壞：
#   - 機組高程對齊（依賴每台機組各自的頂層節點）
#   - 貼地平板偵測（依賴逐 mesh 的幾何判斷）
#   - 以材質名稱為索引的 PBR 設定檔
#
# 重新產生：bash scripts/compress-models.sh
set -euo pipefail
cd "$(dirname "$0")/.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# CLI 只安裝一次。每個檔案都用 npx 會重複下載，21 個檔跑不完。
echo "安裝 gltf-transform…"
npm install --silent --no-save --no-audit --no-fund --prefix "$tmp" @gltf-transform/cli >/dev/null
GT="$tmp/node_modules/.bin/gltf-transform"

mkdir -p 3D-draco
for src in 3D/*.glb; do
  name=$(basename "$src")
  "$GT" resize "$src" "$tmp/a.glb" --width 1024 --height 1024 >/dev/null
  "$GT" webp "$tmp/a.glb" "$tmp/b.glb" >/dev/null
  "$GT" draco "$tmp/b.glb" "3D-draco/$name" >/dev/null
  printf '%-32s %8s → %8s\n' "${name:0:31}" \
    "$(du -h "$src" | cut -f1)" "$(du -h "3D-draco/$name" | cut -f1)"
done

echo
echo "原始 $(du -sh 3D | cut -f1)　→　壓縮後 $(du -sh 3D-draco | cut -f1)"
