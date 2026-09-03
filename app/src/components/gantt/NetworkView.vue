<script setup lang="ts">
import { computed } from 'vue'
import { useScheduleStore } from '@/stores/schedule'
import { useViewerStore } from '@/stores/viewer'
import { DEFAULT_LAYOUT, edgePath, layoutNetwork } from '@/lib/network'
import { STEP_BY_ID } from '@/data/installSteps'

const store = useScheduleStore()
const viewer = useViewerStore()
const L = DEFAULT_LAYOUT

const layout = computed(() =>
  layoutNetwork(store.rows.map((r) => ({ id: r.step.id, deps: r.step.deps }))),
)

const rowById = computed(() => new Map(store.rows.map((r) => [r.step.id, r])))

const n1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1)

/** 箭線：兩端都在要徑上且確實相鄰時才算要徑箭線 */
const edges = computed(() =>
  layout.value.edges.map((e) => {
    const from = layout.value.nodes.get(e.from)!
    const to = layout.value.nodes.get(e.to)!
    const rf = rowById.value.get(e.from)
    const rt = rowById.value.get(e.to)
    const lag = STEP_BY_ID.get(e.from)?.lagDays ?? 0
    // 前置完工 + lag 恰好等於後續開工，代表這條相依正在驅動排程
    const driving =
      !!rf && !!rt && Math.abs(rf.task.finish + lag - rt.task.start) < 0.001
    return {
      key: `${e.from}->${e.to}`,
      d: edgePath(from, to, L),
      critical: !!rf?.task.critical && !!rt?.task.critical && driving,
      lag,
      labelX: from.x + L.nodeWidth + 14,
      labelY: from.y + L.nodeHeight / 2 - 6,
    }
  }),
)

const nodes = computed(() =>
  [...layout.value.nodes.values()].map((n) => ({ ...n, row: rowById.value.get(n.id)! })),
)

function select(id: string) {
  store.selectedId = id
  const partId = STEP_BY_ID.get(id)?.partId
  if (partId) viewer.isolatedId = partId
}
</script>

<template>
  <div class="net">
    <div class="net__legend">
      <span class="key key--critical" />要徑
      <span class="key key--normal" />非要徑
      <span class="net__gap" />
      <span class="net__note">格內：ES / 工期 / EF ｜ LS / 浮時 / LF</span>
    </div>

    <p v-if="layout.cycle" class="net__error">
      相依關係成環，無法繪製網圖：{{ layout.cycle.join('、') }}
    </p>

    <div v-else class="net__scroll">
      <svg :width="layout.width" :height="layout.height" class="net__svg">
        <defs>
          <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="#5b6b86" />
          </marker>
          <marker id="arrow-c" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="#e11d48" />
          </marker>
        </defs>

        <g class="edges">
          <path
            v-for="e in edges"
            :key="e.key"
            :d="e.d"
            :class="{ 'is-critical': e.critical }"
            :marker-end="e.critical ? 'url(#arrow-c)' : 'url(#arrow)'"
          />
          <text v-for="e in edges.filter((x) => x.lag > 0)" :key="`lag-${e.key}`" :x="e.labelX" :y="e.labelY" class="lag">
            +{{ e.lag }}d 養護
          </text>
        </g>

        <g
          v-for="n in nodes"
          :key="n.id"
          class="node"
          :class="{
            'is-critical': n.row.task.critical,
            'is-selected': store.selectedId === n.id,
            'has-no-model': !n.row.step.partId,
          }"
          :transform="`translate(${n.x}, ${n.y})`"
          @click="select(n.id)"
        >
          <rect :width="L.nodeWidth" :height="L.nodeHeight" rx="6" />

          <line :x1="0" :y1="20" :x2="L.nodeWidth" :y2="20" class="sep" />
          <line :x1="0" :y1="56" :x2="L.nodeWidth" :y2="56" class="sep" />

          <text class="es" x="8" y="14">{{ n1(n.row.task.start) }}</text>
          <text class="dur" :x="L.nodeWidth / 2" y="14">{{ n1(n.row.duration) }}</text>
          <text class="ef" :x="L.nodeWidth - 8" y="14">{{ n1(n.row.task.finish) }}</text>

          <text class="seq" x="8" y="36">{{ n.row.wbs }}</text>
          <text class="name" x="8" y="50">{{ n.row.step.name }}</text>

          <text class="ls" x="8" y="71">{{ n1(n.row.task.lateStart) }}</text>
          <text class="float" :x="L.nodeWidth / 2" y="71">{{ n1(n.row.task.float) }}</text>
          <text class="lf" :x="L.nodeWidth - 8" y="71">{{ n1(n.row.task.lateFinish) }}</text>
        </g>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.net { display: flex; flex-direction: column; height: 100%; min-height: 0; }

.net__legend {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  font-size: 11px;
  flex: none;
}
.key { width: 16px; height: 2px; display: inline-block; }
.key--critical { background: #e11d48; }
.key--normal { background: #5b6b86; margin-left: 10px; }
.net__gap { flex: 1; }
.net__note { font-variant-numeric: tabular-nums; }

.net__scroll { flex: 1; overflow: auto; min-height: 0; }
.net__svg { display: block; }

.edges path { fill: none; stroke: #5b6b86; stroke-width: 1.4; }
.edges path.is-critical { stroke: #e11d48; stroke-width: 2; }
.lag { fill: var(--muted); font-size: 9px; }

.node { cursor: pointer; }
.node rect { fill: #16243a; stroke: #33455f; stroke-width: 1.2; }
.node:hover rect { stroke: var(--accent); }
.node.is-critical rect { stroke: #e11d48; fill: #26192a; }
.node.is-selected rect { stroke: var(--accent); stroke-width: 2.2; }

.node .sep { stroke: #ffffff14; stroke-width: 1; }

.node text { fill: var(--muted); font-size: 10px; font-variant-numeric: tabular-nums; }
.node .dur, .node .float { text-anchor: middle; }
.node .ef, .node .lf { text-anchor: end; }
.node .dur { fill: var(--text); font-weight: 600; }
.node .seq { fill: var(--accent); font-size: 10px; font-weight: 600; }
.node .name { fill: var(--text); font-size: 11px; }
.node.has-no-model .name { fill: var(--muted); }
.node.is-critical .seq { fill: #ff6b8a; }
</style>
