<script setup lang="ts">
import { ref } from 'vue'
import type { GanttRow } from '@/stores/schedule'
import { useScheduleStore } from '@/stores/schedule'

const props = defineProps<{ row: GanttRow; dayWidth: number }>()
const store = useScheduleStore()

type Mode = 'move' | 'resize'
const drag = ref<{ mode: Mode; startX: number; baseStart: number; baseDuration: number } | null>(null)

function begin(mode: Mode, e: PointerEvent) {
  e.stopPropagation()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  drag.value = {
    mode,
    startX: e.clientX,
    baseStart: props.row.task.start,
    baseDuration: props.row.duration,
  }
}

function move(e: PointerEvent) {
  const d = drag.value
  if (!d) return
  const delta = Math.round((e.clientX - d.startX) / props.dayWidth)
  if (delta === 0) return
  if (d.mode === 'move') {
    store.setPinnedStart(props.row.step.id, d.baseStart + delta)
  } else {
    // 工期至少 1 天，拖到 0 會讓長條消失而無法再抓回來
    store.setDuration(props.row.step.id, Math.max(1, d.baseDuration + delta))
  }
}

function end() {
  drag.value = null
}
</script>

<template>
  <div
    class="bar"
    :class="{
      'is-critical': row.task.critical,
      'is-selected': store.selectedId === row.step.id,
      'is-dragging': !!drag,
      'has-no-model': !row.step.partId,
    }"
    :style="{
      left: `${row.task.start * dayWidth}px`,
      width: `${Math.max(row.duration, 0.5) * dayWidth}px`,
    }"
    :title="`${row.step.name}｜第 ${row.task.start + 1}–${row.task.finish} 天｜浮時 ${row.task.float} 天`"
    @pointerdown="begin('move', $event)"
    @pointermove="move"
    @pointerup="end"
    @pointercancel="end"
    @click="store.selectedId = row.step.id"
  >
    <span class="bar__fill" :style="{ width: `${row.progress}%` }" />
    <span class="bar__label">{{ row.step.seq }}</span>
    <span
      class="bar__handle"
      title="拖曳調整工期"
      @pointerdown="begin('resize', $event)"
      @pointermove="move"
      @pointerup="end"
      @pointercancel="end"
    />
  </div>
</template>

<style scoped>
.bar {
  position: absolute;
  top: 5px;
  height: 18px;
  border-radius: 4px;
  background: #3b82f6;
  cursor: grab;
  touch-action: none;
  display: flex;
  align-items: center;
  overflow: hidden;
  box-shadow: 0 1px 3px #0006;
}
.bar.is-dragging { cursor: grabbing; }
.bar.is-critical { background: #e11d48; }
.bar.has-no-model { background: #64748b; }
.bar.is-selected { outline: 2px solid var(--accent); outline-offset: 1px; }

.bar__fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: #ffffff40;
  pointer-events: none;
}
.bar__label {
  position: relative;
  padding: 0 6px;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  pointer-events: none;
}
.bar__handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 7px;
  cursor: col-resize;
  background: #ffffff30;
}
.bar__handle:hover { background: #ffffff70; }
</style>
