<script setup lang="ts">
import { computed } from 'vue'
import { useScheduleStore } from '@/stores/schedule'
import { dayToDate } from '@/lib/schedule'

/** 同時顯示幾個步驟名稱，超過就摺成「+N」 */
const MAX_NAMES = 3

const store = useScheduleStore()

const visible = computed(() => store.cursorDay !== null)

const dateLabel = computed(() => {
  if (store.cursorDay === null) return ''
  const d = dayToDate(store.projectStartDate, store.cursorDay)
  return `第 ${store.cursorDay + 1} 天 · ${d.getMonth() + 1}/${d.getDate()}`
})

const shown = computed(() => store.activeSteps.slice(0, MAX_NAMES))
const overflow = computed(() => Math.max(0, store.activeSteps.length - MAX_NAMES))

/** 全部完工之後不該再顯示「今日無施工項目」，那會讓人以為停工了 */
const finished = computed(
  () => store.cursorDay !== null && store.cursorDay >= store.projectDays,
)
</script>

<template>
  <div v-if="visible" class="subtitle">
    <div class="subtitle__day">{{ dateLabel }}</div>

    <div v-if="finished" class="subtitle__names subtitle__names--done">安裝完成</div>

    <div v-else-if="shown.length" class="subtitle__names">
      <span
        v-for="r in shown"
        :key="r.step.id"
        class="name"
        :class="{ 'is-critical': r.task.critical }"
      >
        <em class="name__seq">{{ r.step.seq }}</em>
        {{ r.step.name }}
      </span>
      <span v-if="overflow" class="name name--more">+{{ overflow }}</span>
    </div>

    <div v-else class="subtitle__names subtitle__names--idle">今日無施工項目</div>
  </div>
</template>

<style scoped>
.subtitle {
  position: absolute;
  left: 50%;
  bottom: 62px;
  transform: translateX(-50%);
  max-width: min(92%, 620px);
  padding: 8px 16px 10px;
  border-radius: 10px;
  background: #0b1322d9;
  backdrop-filter: blur(8px);
  border: 1px solid var(--line);
  text-align: center;
  pointer-events: none;
}

.subtitle__day {
  color: var(--muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  margin-bottom: 4px;
}

.subtitle__names {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 14px;
  font-size: 15px;
  line-height: 1.35;
}
.subtitle__names--idle,
.subtitle__names--done { color: var(--muted); font-size: 14px; }
.subtitle__names--done { color: var(--accent); }

.name { white-space: nowrap; }
.name.is-critical { color: #ff8098; }
.name--more { color: var(--muted); }

.name__seq {
  font-style: normal;
  display: inline-block;
  min-width: 17px;
  margin-right: 4px;
  padding: 1px 4px;
  border-radius: 4px;
  background: #ffffff1a;
  color: var(--muted);
  font-size: 10px;
  vertical-align: 2px;
  font-variant-numeric: tabular-nums;
}
.is-critical .name__seq { background: #ff80981f; color: #ff8098; }
</style>
