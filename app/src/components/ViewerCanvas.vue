<script setup lang="ts">
import { computed, ref } from 'vue'
import { useViewer } from '@/composables/useViewer'
import { useViewerStore } from '@/stores/viewer'
import { usePoiStore } from '@/stores/poi'
import { SHELL_PART_ID } from '@/data/parts'
import ExplodeSlider from './ExplodeSlider.vue'
import LoadProgress from './LoadProgress.vue'
import PoiCard from './PoiCard.vue'
import StepSubtitle from './StepSubtitle.vue'

const host = ref<HTMLDivElement | null>(null)
const { fatal, resetView, placePoiAt, activePoiScreen } = useViewer(host)
const store = useViewerStore()
const poi = usePoiStore()

/** 外牆隱藏與側欄「機房外殼」勾選框是同一個狀態，兩邊操作會互相反映 */
const shellHidden = computed(() => !store.isVisible(SHELL_PART_ID))

function toggleShellHidden() {
  store.setVisible(SHELL_PART_ID, shellHidden.value)
}

// 拖曳轉動視角時不應該放下標記，因此比對按下與放開的位移量
let down: { x: number; y: number } | null = null
const DRAG_SLOP = 4

function onPointerDown(e: PointerEvent) {
  down = { x: e.clientX, y: e.clientY }
}

function onPointerUp(e: PointerEvent) {
  const start = down
  down = null
  if (!poi.editMode || !start) return
  if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > DRAG_SLOP) return
  placePoiAt(e.clientX, e.clientY)
}
</script>

<template>
  <div class="stage" :class="{ 'is-placing': poi.editMode }">
    <div
      ref="host"
      class="stage__canvas"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
    />
    <div v-if="fatal" class="fatal">{{ fatal }}</div>
    <template v-else>
      <div class="overlay toolbar">
        <button
          class="toolbar__btn"
          :class="{ 'is-on': poi.editMode }"
          :aria-pressed="poi.editMode"
          title="開啟後，點模型表面即可新增標記"
          @click="poi.editMode = !poi.editMode"
        >
          標記 <span v-if="poi.pois.length" class="toolbar__badge">{{ poi.pois.length }}</span>
        </button>
        <span class="toolbar__sep" />
        <button
          class="toolbar__btn"
          :class="{ 'is-on': shellHidden }"
          :aria-pressed="shellHidden"
          title="機房外牆整個隱藏"
          @click="toggleShellHidden()"
        >
          隱藏外牆
        </button>
        <button
          class="toolbar__btn"
          :class="{ 'is-on': store.shellGhost }"
          :aria-pressed="store.shellGhost"
          :disabled="shellHidden"
          title="機房外牆變半透明，仍保留牆的輪廓"
          @click="store.shellGhost = !store.shellGhost"
        >
          外牆透視
        </button>
        <button
          class="toolbar__btn"
          :class="{ 'is-on': store.roomFloor }"
          :aria-pressed="store.roomFloor"
          :disabled="shellHidden"
          title="機房的實體地板；關閉時格線地坪會透到建物內部"
          @click="store.roomFloor = !store.roomFloor"
        >
          機房地板
        </button>
        <span class="toolbar__sep" />
        <button class="toolbar__btn" @click="resetView()">重設視角</button>
      </div>

      <p v-if="poi.editMode" class="overlay hint">點模型表面新增標記 · 拖曳仍可轉動視角</p>

      <StepSubtitle />
      <PoiCard :screen="activePoiScreen" />
      <ExplodeSlider />
      <LoadProgress />
    </template>
  </div>
</template>

<style scoped>
.stage.is-placing .stage__canvas { cursor: crosshair; }

.toolbar {
  right: 16px;
  top: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
}
.toolbar__btn { border: 0; padding: 4px 10px; border-radius: 5px; }
.toolbar__btn:hover { background: #ffffff12; }
.toolbar__btn:disabled { opacity: 0.35; cursor: default; }
.toolbar__btn:disabled:hover { background: transparent; color: inherit; }
.toolbar__sep { width: 1px; align-self: stretch; background: var(--line); margin: 0 2px; }

.toolbar__badge {
  display: inline-block;
  min-width: 16px;
  padding: 0 4px;
  margin-left: 2px;
  border-radius: 8px;
  background: #ffffff1f;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.toolbar__btn.is-on {
  background: var(--accent);
  color: #06121d;
  font-weight: 600;
}
.toolbar__btn.is-on:hover { background: var(--accent); }
.toolbar__btn.is-on .toolbar__badge { background: #06121d29; }

.hint {
  left: 50%;
  top: 16px;
  transform: translateX(-50%);
  margin: 0;
  padding: 5px 12px;
  color: var(--muted);
  white-space: nowrap;
}
</style>
