<script setup lang="ts">
import PartTree from '@/components/PartTree.vue'
import ViewerCanvas from '@/components/ViewerCanvas.vue'
import SplitPane from '@/components/SplitPane.vue'
import SchedulePanel from '@/components/gantt/SchedulePanel.vue'
import { useViewerStore } from '@/stores/viewer'

const store = useViewerStore()
</script>

<template>
  <div class="app">
    <aside class="sidebar">
      <div class="sidebar__head">
        <h1 class="sidebar__title">發電機組 3D 檢視器</h1>
        <div class="sidebar__sub">RZ2000 機房 · {{ store.total }} 個構件</div>
      </div>
      <PartTree />
      <div class="sidebar__foot">
        <button @click="store.showAll()">全部顯示</button>
        <button @click="store.isolatedId = null" :disabled="!store.isolatedId">取消隔離</button>
      </div>
    </aside>

    <SplitPane>
      <template #left><ViewerCanvas /></template>
      <template #right><SchedulePanel /></template>
    </SplitPane>
  </div>
</template>

<style scoped>
.sidebar__foot {
  display: flex;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--line);
}
.sidebar__foot button { flex: 1; }
.sidebar__foot button:disabled { opacity: 0.4; cursor: default; border-color: var(--line); color: var(--text); }
</style>
