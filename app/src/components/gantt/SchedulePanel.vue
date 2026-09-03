<script setup lang="ts">
import { ref } from 'vue'
import { useScheduleStore } from '@/stores/schedule'
import GanttPanel from './GanttPanel.vue'
import WbsView from './WbsView.vue'
import NetworkView from './NetworkView.vue'
import SCurveView from './SCurveView.vue'

type Tab = 'gantt' | 'wbs' | 'network' | 'scurve'
const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: 'gantt', label: '甘特圖', hint: '時間軸與進度模擬' },
  { key: 'wbs', label: 'WBS', hint: '工作分解結構與三點估算' },
  { key: 'network', label: '網圖', hint: 'PDM 前導圖，含要徑' },
  { key: 'scurve', label: 'S 曲線', hint: '計畫值與實獲值累計進度' },
]

const tab = ref<Tab>('gantt')
const store = useScheduleStore()

/** 目標工期以期望值進位到整天為基準，往後兩天看達成機率 */
const pct = (v: number) => `${Math.round(v * 100)}%`
</script>

<template>
  <div class="panel">
    <nav class="panel__tabs">
      <button
        v-for="t in TABS"
        :key="t.key"
        class="tab"
        :class="{ 'is-on': tab === t.key }"
        :title="t.hint"
        @click="tab = t.key"
      >
        {{ t.label }}
      </button>

      <span class="panel__spacer" />

      <span class="pert" :title="`要徑上 ${store.pertSummary.criticalCount} 項活動的變異數總和`">
        期望 <b>{{ store.pertSummary.expectedDays.toFixed(1) }}</b> 天
        <span class="pert__sd">σ {{ store.pertSummary.stdDev.toFixed(2) }}</span>
      </span>
      <span class="pert" title="依 PERT 常態近似估算">
        {{ Math.ceil(store.pertSummary.expectedDays) }} 天內完工
        <b>{{ pct(store.pertSummary.probabilityWithin(Math.ceil(store.pertSummary.expectedDays))) }}</b>
      </span>
    </nav>

    <div class="panel__body">
      <GanttPanel v-show="tab === 'gantt'" />
      <WbsView v-if="tab === 'wbs'" />
      <NetworkView v-if="tab === 'network'" />
      <SCurveView v-if="tab === 'scurve'" />
    </div>
  </div>
</template>

<style scoped>
.panel { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--panel-solid); }

.panel__tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px 0;
  border-bottom: 1px solid var(--line);
  flex: none;
}
.panel__spacer { flex: 1; }

.tab {
  border: 1px solid transparent;
  border-bottom: 0;
  border-radius: 6px 6px 0 0;
  padding: 5px 14px;
  color: var(--muted);
  margin-bottom: -1px;
  white-space: nowrap;
}
.tab:hover { color: var(--text); background: #ffffff0a; }
.tab.is-on {
  color: var(--text);
  background: var(--panel-solid);
  border-color: var(--line);
  border-bottom: 1px solid var(--panel-solid);
  font-weight: 600;
}

.pert {
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
  margin-bottom: 6px;
  margin-left: 12px;
}
.pert b { color: var(--text); font-variant-numeric: tabular-nums; }
.pert__sd { margin-left: 4px; font-variant-numeric: tabular-nums; }

.panel__body { flex: 1; min-height: 0; display: flex; }
.panel__body > * { flex: 1; min-width: 0; min-height: 0; }
</style>
