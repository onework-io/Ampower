<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

const STORAGE_KEY = 'generator-split-ratio'
const MIN = 0.25
const MAX = 0.8

function loadRatio(): number {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isFinite(v) && v >= MIN && v <= MAX ? v : 0.46
  } catch {
    return 0.58
  }
}

const ratio = ref(loadRatio())
const rootEl = ref<HTMLElement | null>(null)
let dragging = false

function onDown(e: PointerEvent) {
  dragging = true
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function onMove(e: PointerEvent) {
  if (!dragging || !rootEl.value) return
  const r = rootEl.value.getBoundingClientRect()
  ratio.value = Math.min(MAX, Math.max(MIN, (e.clientX - r.left) / r.width))
}

function onUp() {
  if (!dragging) return
  dragging = false
  try {
    localStorage.setItem(STORAGE_KEY, String(ratio.value))
  } catch {
    // 存不了就算了，只是下次回到預設比例
  }
}

onBeforeUnmount(onUp)
</script>

<template>
  <div ref="rootEl" class="split" :style="{ '--ratio': ratio }">
    <div class="split__pane"><slot name="left" /></div>
    <div
      class="split__handle"
      role="separator"
      aria-orientation="vertical"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    />
    <div class="split__pane"><slot name="right" /></div>
  </div>
</template>

<style scoped>
.split {
  display: grid;
  grid-template-columns: calc(var(--ratio) * 100%) 5px 1fr;
  height: 100%;
  min-height: 0;
}
.split__pane {
  position: relative;
  min-width: 0;
  min-height: 0;
  /* 讓插槽內容（3D 舞台、甘特圖）撐滿整個窗格，否則高度會塌成 0 */
  display: flex;
}
.split__pane > * { flex: 1; min-width: 0; min-height: 0; }
.split__handle {
  cursor: col-resize;
  background: var(--line);
  touch-action: none;
}
.split__handle:hover { background: var(--accent); }
</style>
