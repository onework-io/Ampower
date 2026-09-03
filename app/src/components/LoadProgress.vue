<script setup lang="ts">
import { useViewerStore } from '@/stores/viewer'

const store = useViewerStore()
</script>

<template>
  <div v-if="!store.allReady" class="overlay load">
    <div class="load__bar">
      <span :style="{ width: `${(store.loadedCount / store.total) * 100}%` }" />
    </div>
    <span class="load__text">載入模型 {{ store.loadedCount }} / {{ store.total }}</span>
  </div>

  <div v-else-if="store.failed.length" class="overlay load load--warn">
    {{ store.failed.length }} 個構件載入失敗：{{ store.failed.map((p) => p.name).join('、') }}
  </div>
</template>

<style scoped>
.load {
  right: 16px;
  bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-variant-numeric: tabular-nums;
}
.load__bar {
  width: 140px;
  height: 4px;
  border-radius: 2px;
  background: #ffffff1a;
  overflow: hidden;
}
.load__bar span {
  display: block;
  height: 100%;
  background: var(--accent);
  transition: width 0.25s ease;
}
.load__text { color: var(--muted); }
.load--warn { color: var(--danger); max-width: 420px; }
</style>
