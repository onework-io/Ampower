<script setup lang="ts">
import { computed } from 'vue'
import { useViewerStore } from '@/stores/viewer'

const store = useViewerStore()
const pct = computed(() => Math.round(store.explodeFactor * 100))
</script>

<template>
  <div class="overlay explode">
    <label class="explode__label" for="explode">
      爆炸圖
      <span class="explode__pct">{{ pct }}%</span>
    </label>
    <input
      id="explode"
      type="range"
      min="0"
      max="1"
      step="0.01"
      :value="store.explodeFactor"
      @input="store.explodeFactor = Number(($event.target as HTMLInputElement).value)"
    />
    <button class="explode__reset" @click="store.explodeFactor = 0">歸位</button>
  </div>
</template>

<style scoped>
.explode {
  left: 16px;
  bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.explode__label { display: flex; gap: 8px; align-items: baseline; white-space: nowrap; }
.explode__pct { color: var(--muted); font-variant-numeric: tabular-nums; min-width: 34px; }
.explode input[type='range'] { width: 200px; accent-color: var(--accent); }
.explode__reset { padding: 2px 8px; }
</style>
