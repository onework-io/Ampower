<script setup lang="ts">
import { ref } from 'vue'
import { useScheduleStore } from '@/stores/schedule'
import { useViewerStore } from '@/stores/viewer'
import { dayToDate } from '@/lib/schedule'

const store = useScheduleStore()
const viewer = useViewerStore()
const collapsed = ref(new Set<string>())

function toggle(phase: string) {
  const next = new Set(collapsed.value)
  next.has(phase) ? next.delete(phase) : next.add(phase)
  collapsed.value = next
}

const fmt = (offset: number) => {
  const d = dayToDate(store.projectStartDate, Math.round(offset))
  return `${d.getMonth() + 1}/${d.getDate()}`
}
const n1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1)

function select(id: string, partId: string | null) {
  store.selectedId = id
  if (partId) viewer.isolatedId = partId
}
</script>

<template>
  <div class="wbs">
    <div class="wbs__head">
      <span class="c-wbs">WBS</span>
      <span class="c-name">工作項目</span>
      <span class="c-num" title="樂觀">O</span>
      <span class="c-num" title="最可能">M</span>
      <span class="c-num" title="悲觀">P</span>
      <span class="c-num" title="期望工期 te = (O+4M+P)/6">te</span>
      <span class="c-date">起</span>
      <span class="c-date">迄</span>
      <span class="c-num" title="總浮時">浮時</span>
      <span class="c-num">%</span>
    </div>

    <div class="wbs__body">
      <template v-for="g in store.wbsGroups" :key="g.phase">
        <div class="row row--group" :class="{ 'is-critical': g.critical }" @click="toggle(g.phase)">
          <span class="c-wbs">
            <span class="caret" :class="{ 'is-collapsed': collapsed.has(g.phase) }">▾</span>
            {{ g.wbs }}
          </span>
          <span class="c-name">{{ g.phase }}<em class="count">{{ g.items.length }}</em></span>
          <span class="c-num" />
          <span class="c-num" />
          <span class="c-num" />
          <span class="c-num">{{ n1(g.work) }}</span>
          <span class="c-date">{{ fmt(g.start) }}</span>
          <span class="c-date">{{ fmt(g.finish) }}</span>
          <span class="c-num span" :title="`階段跨距 ${n1(g.span)} 天（含等待）`">{{ n1(g.span) }}</span>
          <span class="c-num">{{ g.progress }}</span>
        </div>

        <template v-if="!collapsed.has(g.phase)">
          <div
            v-for="r in g.items"
            :key="r.step.id"
            class="row"
            :class="{
              'is-critical': r.task.critical,
              'is-selected': store.selectedId === r.step.id,
              'has-no-model': !r.step.partId,
            }"
            @click="select(r.step.id, r.step.partId)"
          >
            <span class="c-wbs">{{ r.wbs }}</span>
            <span class="c-name" :title="r.step.name">{{ r.step.name }}</span>
            <input
              class="c-num edit"
              type="number"
              min="0"
              :value="r.tp.o"
              aria-label="樂觀工期"
              @click.stop
              @change="store.setEstimate(r.step.id, 'o', Number(($event.target as HTMLInputElement).value))"
            />
            <input
              class="c-num edit"
              type="number"
              min="0"
              :value="r.tp.m"
              aria-label="最可能工期"
              @click.stop
              @change="store.setEstimate(r.step.id, 'm', Number(($event.target as HTMLInputElement).value))"
            />
            <input
              class="c-num edit"
              type="number"
              min="0"
              :value="r.tp.p"
              aria-label="悲觀工期"
              @click.stop
              @change="store.setEstimate(r.step.id, 'p', Number(($event.target as HTMLInputElement).value))"
            />
            <span class="c-num te">{{ n1(r.duration) }}</span>
            <span class="c-date">{{ fmt(r.task.start) }}</span>
            <span class="c-date">{{ fmt(r.task.finish) }}</span>
            <span class="c-num">{{ n1(r.task.float) }}</span>
            <span class="c-num">{{ r.progress }}</span>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.wbs { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.wbs__body { flex: 1; overflow: auto; min-height: 0; }

.wbs__head,
.row {
  display: grid;
  grid-template-columns: 44px minmax(120px, 1fr) 38px 38px 38px 42px 46px 46px 42px 34px;
  align-items: center;
  gap: 4px;
  padding: 0 10px;
  height: 26px;
}
.wbs__head {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #101a2b;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  font-size: 10px;
}

.row { border-bottom: 1px solid #ffffff08; cursor: pointer; }
.row:hover { background: #ffffff0a; }
.row--group { background: #ffffff0a; font-weight: 600; }
.row--group:hover { background: #ffffff14; }
.row.is-selected { background: #4cc2ff1f; }
.row.is-critical .c-wbs { color: var(--danger); }
.row.has-no-model .c-name { color: var(--muted); }

.c-wbs { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
.row--group .c-wbs { color: var(--text); }
.c-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.count { font-style: normal; margin-left: 6px; color: var(--muted); font-weight: 400; font-size: 10px; }

.c-num, .c-date {
  text-align: right;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}
.te { color: var(--text); font-weight: 600; }
.span { color: var(--muted); }

.edit {
  background: #0b1322;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--text);
  font: inherit;
  font-size: 11px;
  padding: 1px 3px;
  min-width: 0;
}
.caret { display: inline-block; transition: transform 0.15s; font-size: 9px; }
.caret.is-collapsed { transform: rotate(-90deg); }
</style>
