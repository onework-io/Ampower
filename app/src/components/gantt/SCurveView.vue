<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useScheduleStore } from '@/stores/schedule'
import { dayToDate } from '@/lib/schedule'
import { dayAtPct, pctAt, scheduleVarianceDays, spi, type CurvePoint } from '@/lib/scurve'

/**
 * 系列色通過 dataviz 六項檢查（深色底 #162033）：
 * 計畫 #3b82f6 與實際 #d97706，CVD 最差配對 ΔE 30.2、對比皆 ≥ 3:1。
 */
const C_PLAN = '#3b82f6'
const C_ACTUAL = '#d97706'

const PAD = { top: 18, right: 68, bottom: 34, left: 44 }
const store = useScheduleStore()

const box = ref({ w: 640, h: 320 })
const hoverDay = ref<number | null>(null)
const plotEl = ref<SVGSVGElement | null>(null)

/**
 * 以量到的實際像素尺寸繪製，不用 viewBox 縮放。
 * 若用 preserveAspectRatio="none" 讓 SVG 自行拉伸，座標軸文字會跟著被非等比壓扁。
 */
let ro: ResizeObserver | null = null
watch(plotEl, (el) => {
  ro?.disconnect()
  if (!el) return
  ro = new ResizeObserver(([entry]) => {
    const r = entry.contentRect
    if (r.width > 0 && r.height > 0) box.value = { w: r.width, h: r.height }
  })
  ro.observe(el)
})
onBeforeUnmount(() => ro?.disconnect())

const maxDay = computed(() => Math.max(Math.ceil(store.projectDays), 1))
const inner = computed(() => ({
  w: Math.max(80, box.value.w - PAD.left - PAD.right),
  h: Math.max(60, box.value.h - PAD.top - PAD.bottom),
}))

const sx = (day: number) => PAD.left + (day / maxDay.value) * inner.value.w
const sy = (pct: number) => PAD.top + (1 - pct / 100) * inner.value.h

const path = (curve: CurvePoint[]) =>
  curve.map((p, i) => `${i ? 'L' : 'M'} ${sx(p.day).toFixed(1)} ${sy(p.pct).toFixed(1)}`).join(' ')

/** 香蕉包絡：最早曲線去、最晚曲線回 */
const bandPath = computed(() => {
  const e = store.plannedEarly
  const l = store.plannedLate
  if (!e.length || !l.length) return ''
  return `${path(e)} L ${sx(l[l.length - 1].day)} ${sy(l[l.length - 1].pct)} ${[...l]
    .reverse()
    .map((p) => `L ${sx(p.day).toFixed(1)} ${sy(p.pct).toFixed(1)}`)
    .join(' ')} Z`
})

/**
 * 實際曲線。開工日必然是 0%，因此若第一筆歷程不在第 0 天就補一個原點，
 * 否則曲線會憑空從半空中開始。
 */
const actualCurve = computed<CurvePoint[]>(() => {
  const log = store.progressLog
  if (!log.length) return []
  return log[0].day > 0 ? [{ day: 0, pct: 0 }, ...log] : [...log]
})
const actualPath = computed(() => (actualCurve.value.length > 1 ? path(actualCurve.value) : ''))

const pvNow = computed(() => pctAt(store.plannedEarly, store.dataDay))
const evNow = computed(() => store.currentEarned)
const spiNow = computed(() => spi(evNow.value, pvNow.value))
const varianceDays = computed(() =>
  scheduleVarianceDays(store.plannedEarly, evNow.value, store.dataDay),
)
/** 目前實獲值對應到計畫曲線上的日子，用來畫落後／超前的水平指引 */
const evOnPlanDay = computed(() => dayAtPct(store.plannedEarly, evNow.value))

const fmtDate = (day: number) => {
  const d = dayToDate(store.projectStartDate, Math.round(day))
  return `${d.getMonth() + 1}/${d.getDate()}`
}
const n1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1)

/** X 軸刻度：整週一格，最多 12 格 */
const ticksX = computed(() => {
  const step = Math.max(1, Math.ceil(maxDay.value / 12 / 7) * 7)
  const out: number[] = []
  for (let d = 0; d <= maxDay.value; d += step) out.push(d)
  if (out[out.length - 1] !== maxDay.value) out.push(maxDay.value)
  return out
})
const ticksY = [0, 25, 50, 75, 100]

const hover = computed(() => {
  if (hoverDay.value === null) return null
  const day = Math.min(Math.max(hoverDay.value, 0), maxDay.value)
  return {
    day,
    plan: pctAt(store.plannedEarly, day),
    late: pctAt(store.plannedLate, day),
    actual: actualCurve.value.length ? pctAt(actualCurve.value, day) : null,
  }
})

function onMove(e: PointerEvent) {
  const el = plotEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  hoverDay.value = ((e.clientX - r.left - PAD.left) / inner.value.w) * maxDay.value
}
</script>

<template>
  <div class="sc">
    <div class="sc__stats">
      <span class="stat">
        資料日期 <b>{{ fmtDate(store.dataDay) }}</b>
        <em>第 {{ store.dataDay + 1 }} 天</em>
      </span>
      <span class="stat">
        計畫 <b :style="{ color: C_PLAN }">{{ n1(pvNow) }}%</b>
      </span>
      <span class="stat">
        實際 <b :style="{ color: C_ACTUAL }">{{ n1(evNow) }}%</b>
      </span>
      <span class="stat" title="進度績效指標 SPI = 實獲值 / 計畫值">
        SPI <b>{{ spiNow === null ? '—' : spiNow.toFixed(2) }}</b>
      </span>
      <span
        v-if="varianceDays !== null"
        class="stat"
        :class="varianceDays < -0.05 ? 'is-behind' : varianceDays > 0.05 ? 'is-ahead' : ''"
      >
        {{ varianceDays < 0 ? '落後' : varianceDays > 0 ? '超前' : '準時' }}
        <b>{{ Math.abs(varianceDays).toFixed(1) }} 天</b>
      </span>
      <span class="sc__spacer" />
      <button v-if="store.progressLog.length" @click="store.clearProgressLog()">清除歷程</button>
      <button @click="store.logProgress()">記錄目前進度</button>
    </div>

    <div class="sc__legend">
      <span class="lg"><i :style="{ background: C_PLAN }" />計畫值 PV（最早）</span>
      <span class="lg"><i class="lg--band" :style="{ background: C_PLAN }" />最早～最晚包絡</span>
      <span class="lg"><i :style="{ background: C_ACTUAL }" />實際 EV</span>
    </div>

    <div class="sc__plot">
      <svg
        ref="plotEl"
        class="sc__svg"
        :width="box.w"
        :height="box.h"
        @pointermove="onMove"
        @pointerleave="hoverDay = null"
      >
        <!-- 格線 -->
        <g class="grid">
          <line v-for="t in ticksY" :key="`y${t}`" :x1="PAD.left" :y1="sy(t)" :x2="box.w - PAD.right" :y2="sy(t)" />
          <line v-for="t in ticksX" :key="`x${t}`" :x1="sx(t)" :y1="PAD.top" :x2="sx(t)" :y2="sy(0)" />
        </g>

        <!-- 香蕉包絡 -->
        <path :d="bandPath" class="band" :style="{ fill: C_PLAN }" />

        <!-- 計畫曲線 -->
        <path :d="path(store.plannedLate)" class="line line--dashed" :style="{ stroke: C_PLAN }" />
        <path :d="path(store.plannedEarly)" class="line" :style="{ stroke: C_PLAN }" />

        <!-- 實際曲線（有歷程才畫） -->
        <path v-if="actualPath" :d="actualPath" class="line" :style="{ stroke: C_ACTUAL }" />

        <!-- 落後／超前的水平指引 -->
        <line
          v-if="evOnPlanDay !== null && Math.abs((varianceDays ?? 0)) > 0.05"
          class="guide"
          :x1="sx(Math.min(evOnPlanDay, store.dataDay))"
          :y1="sy(evNow)"
          :x2="sx(Math.max(evOnPlanDay, store.dataDay))"
          :y2="sy(evNow)"
        />

        <!-- 資料日期 -->
        <line class="today" :x1="sx(store.dataDay)" :y1="PAD.top" :x2="sx(store.dataDay)" :y2="sy(0)" />

        <!-- 目前實獲值 -->
        <circle class="ev-dot" :cx="sx(store.dataDay)" :cy="sy(evNow)" r="5" :style="{ fill: C_ACTUAL }" />
        <circle class="pv-dot" :cx="sx(store.dataDay)" :cy="sy(pvNow)" r="4" :style="{ fill: C_PLAN }" />

        <!-- 直接標示，識別不只靠顏色 -->
        <text class="tag" :x="box.w - PAD.right + 6" :y="sy(pctAt(store.plannedEarly, maxDay)) + 4" :style="{ fill: C_PLAN }">
          計畫
        </text>
        <text class="tag" :x="sx(store.dataDay) + 8" :y="sy(evNow) - 8" :style="{ fill: C_ACTUAL }">
          實際 {{ n1(evNow) }}%
        </text>

        <!-- 座標軸 -->
        <g class="axis">
          <text v-for="t in ticksY" :key="`ty${t}`" class="ty" :x="PAD.left - 8" :y="sy(t) + 4">
            {{ t }}%
          </text>
          <text v-for="t in ticksX" :key="`tx${t}`" class="tx" :x="sx(t)" :y="sy(0) + 18">
            {{ fmtDate(t) }}
          </text>
        </g>

        <!-- 十字準星 -->
        <g v-if="hover">
          <line class="crosshair" :x1="sx(hover.day)" :y1="PAD.top" :x2="sx(hover.day)" :y2="sy(0)" />
          <circle :cx="sx(hover.day)" :cy="sy(hover.plan)" r="4" :style="{ fill: C_PLAN }" />
          <circle v-if="hover.actual !== null" :cx="sx(hover.day)" :cy="sy(hover.actual)" r="4" :style="{ fill: C_ACTUAL }" />
        </g>
      </svg>

      <div v-if="hover" class="tip" :style="{ left: `${sx(hover.day)}px` }">
        <div class="tip__day">{{ fmtDate(hover.day) }}</div>
        <div><i :style="{ background: C_PLAN }" />計畫 {{ n1(hover.plan) }}%</div>
        <div class="tip__muted">最晚 {{ n1(hover.late) }}%</div>
        <div v-if="hover.actual !== null"><i :style="{ background: C_ACTUAL }" />實際 {{ n1(hover.actual) }}%</div>
      </div>
    </div>

    <p v-if="store.progressLog.length <= 1" class="sc__note">
      實際曲線需要進度歷程才畫得出來——單一時間點的完成度回推不出過去的走勢。
      調整完成度時會自動記錄一筆，也可以按「記錄目前進度」手動存點。
      目前已記錄 {{ store.progressLog.length }} 筆。
    </p>
  </div>
</template>

<style scoped>
.sc { display: flex; flex-direction: column; height: 100%; min-height: 0; }

.sc__stats {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--line);
  flex: none;
  flex-wrap: wrap;
}
.sc__spacer { flex: 1; }
.stat { color: var(--muted); font-size: 11px; white-space: nowrap; }
.stat b { color: var(--text); font-variant-numeric: tabular-nums; margin-left: 3px; }
.stat em { font-style: normal; margin-left: 5px; opacity: 0.7; }
.stat.is-behind b { color: var(--danger); }
.stat.is-ahead b { color: #22c55e; }

.sc__legend {
  display: flex;
  gap: 16px;
  padding: 7px 14px 3px;
  color: var(--muted);
  font-size: 11px;
  flex: none;
}
.lg { display: flex; align-items: center; gap: 6px; }
.lg i { width: 14px; height: 2px; border-radius: 1px; }
.lg .lg--band { height: 9px; opacity: 0.16; border-radius: 2px; }

.sc__plot { position: relative; flex: 1; min-height: 0; padding: 0 4px 6px; }
.sc__svg { display: block; }

.grid line { stroke: #ffffff12; stroke-width: 1; }
.band { opacity: 0.13; }
.line { fill: none; stroke-width: 2; stroke-linejoin: round; }
.line--dashed { stroke-dasharray: 4 4; opacity: 0.55; stroke-width: 1.5; }

.today { stroke: var(--muted); stroke-width: 1.5; stroke-dasharray: 3 3; }
.guide { stroke: var(--danger); stroke-width: 1.5; stroke-dasharray: 2 3; }
.crosshair { stroke: #ffffff40; stroke-width: 1; }

.ev-dot, .pv-dot { stroke: var(--panel-solid); stroke-width: 2; }
.tag { font-size: 11px; font-weight: 600; }
.axis text { fill: var(--muted); font-size: 10px; font-variant-numeric: tabular-nums; }
.axis .ty { text-anchor: end; }
.axis .tx { text-anchor: middle; }

.tip {
  position: absolute;
  top: 10px;
  transform: translateX(-50%);
  background: #0b1322f2;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 6px 9px;
  font-size: 11px;
  pointer-events: none;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.tip__day { color: var(--muted); margin-bottom: 3px; }
.tip__muted { color: var(--muted); }
.tip i { display: inline-block; width: 9px; height: 2px; border-radius: 1px; margin-right: 5px; vertical-align: middle; }

.sc__note {
  margin: 0;
  padding: 8px 14px 10px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
  border-top: 1px solid var(--line);
  flex: none;
}
</style>
