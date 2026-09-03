import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { INSTALL_STEPS, PHASES, PHASE_WBS, type InstallStep } from '@/data/installSteps'
import { completedAt, computeSchedule, type ScheduledTask, type TaskInput } from '@/lib/schedule'
import { earnedPct, plannedCurve, type CurveRow } from '@/lib/scurve'
import {
  clampThreePoint,
  completionProbability,
  defaultThreePoint,
  expectedDuration,
  stdDev,
  variance,
  type ThreePoint,
} from '@/lib/pert'

const STORAGE_KEY = 'generator-schedule-v1'

/** 使用者對單一步驟的調整；未調整的欄位不存，之後改資料檔仍會生效 */
export interface StepOverride {
  pinnedStart?: number
  /** 最可能工期（PERT 的 M） */
  durationDays?: number
  optimisticDays?: number
  pessimisticDays?: number
  /** 完成度 0–100 */
  progress?: number
}

export interface GanttRow {
  step: InstallStep
  task: ScheduledTask
  /** 三點估算 */
  tp: ThreePoint
  /** 期望工期 te，排程實際採用的工期 */
  duration: number
  /** 單一活動的變異數 */
  variance: number
  /** WBS 代號，例如 2.1 */
  wbs: string
  progress: number
  /** 使用者是否調整過這一列 */
  edited: boolean
}

/** 進度歷程的一筆快照 */
export interface ProgressSnapshot {
  /** 記錄當下的資料日期（距開工日的天數） */
  day: number
  /** 當下的實獲值百分比 */
  pct: number
}

interface Persisted {
  projectStart: string
  overrides: Record<string, StepOverride>
  cursorDay: number | null
  playSpeed: number
  progressLog: ProgressSnapshot[]
}

/** 進度模擬的播放倍速選項 */
export const PLAY_SPEEDS = [0.5, 1, 2, 4, 8] as const

function loadPersisted(): Partial<Persisted> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Persisted) : {}
  } catch {
    // 隱私模式或損毀的資料：忽略，用預設值
    return {}
  }
}

export const useScheduleStore = defineStore('schedule', () => {
  const saved = loadPersisted()

  /** 開工日（ISO yyyy-mm-dd），時間軸的第 0 天 */
  const projectStart = ref(saved.projectStart ?? '2026-09-07')
  const overrides = ref<Record<string, StepOverride>>(saved.overrides ?? {})
  const selectedId = ref<string | null>(null)
  /** 進度模擬游標的天數；null 表示關閉模擬、3D 顯示全部構件 */
  const cursorDay = ref<number | null>(saved.cursorDay ?? null)
  /** 播放倍速；1 為每天 420 毫秒 */
  const playSpeed = ref(
    PLAY_SPEEDS.includes(saved.playSpeed as (typeof PLAY_SPEEDS)[number]) ? saved.playSpeed! : 1,
  )
  /**
   * 進度歷程。每次調整完成度時記錄一筆，用來畫真正的實際曲線——
   * 單一時間點的完成度回推不出過去的進度走勢。
   */
  const progressLog = ref<ProgressSnapshot[]>(saved.progressLog ?? [])

  /** 每個步驟的三點估算：使用者覆寫 → 資料檔 → 依 M 推算的預設 */
  const threePoint = computed<Map<string, ThreePoint>>(() => {
    const m = new Map<string, ThreePoint>()
    for (const s of INSTALL_STEPS) {
      const o = overrides.value[s.id]
      const mostLikely = o?.durationDays ?? s.durationDays
      const fallback = defaultThreePoint(mostLikely)
      m.set(s.id, {
        o: o?.optimisticDays ?? s.optimisticDays ?? fallback.o,
        m: mostLikely,
        p: o?.pessimisticDays ?? s.pessimisticDays ?? fallback.p,
      })
    }
    return m
  })

  const inputs = computed<TaskInput[]>(() =>
    INSTALL_STEPS.map((s) => ({
      id: s.id,
      // 排程採用 PERT 期望工期 te，而非最可能工期
      durationDays: expectedDuration(threePoint.value.get(s.id)!),
      deps: s.deps,
      lagDays: s.lagDays,
      pinnedStart: overrides.value[s.id]?.pinnedStart,
    })),
  )

  const schedule = computed(() => computeSchedule(inputs.value))
  const projectDays = computed(() => schedule.value.projectDays)

  /** 依開工日排序的列；同日則依項次，讓長條由左上往右下排 */
  /** WBS 代號：階段序號 . 該階段內的排序 */
  const wbsCodes = computed(() => {
    const counters = new Map<string, number>()
    const codes = new Map<string, string>()
    const ordered = [...INSTALL_STEPS].sort(
      (a, b) => PHASES.indexOf(a.phase as never) - PHASES.indexOf(b.phase as never) || a.seq - b.seq,
    )
    for (const s of ordered) {
      const n = (counters.get(s.phase) ?? 0) + 1
      counters.set(s.phase, n)
      codes.set(s.id, `${PHASE_WBS.get(s.phase) ?? '?'}.${n}`)
    }
    return codes
  })

  const rows = computed<GanttRow[]>(() => {
    const s = schedule.value
    return INSTALL_STEPS.filter((step) => s.tasks.has(step.id))
      .map((step) => {
        const o = overrides.value[step.id]
        const tp = threePoint.value.get(step.id)!
        return {
          step,
          task: s.tasks.get(step.id)!,
          tp,
          duration: expectedDuration(tp),
          variance: variance(tp),
          wbs: wbsCodes.value.get(step.id) ?? '',
          progress: o?.progress ?? 0,
          edited:
            o?.pinnedStart !== undefined ||
            o?.durationDays !== undefined ||
            o?.optimisticDays !== undefined ||
            o?.pessimisticDays !== undefined,
        }
      })
      .sort((a, b) => a.task.start - b.task.start || a.step.seq - b.step.seq)
  })

  /** 依 WBS 第一層分組，含各階段的彙整 */
  const wbsGroups = computed(() => {
    const byPhase = new Map<string, GanttRow[]>()
    for (const r of rows.value) {
      if (!byPhase.has(r.step.phase)) byPhase.set(r.step.phase, [])
      byPhase.get(r.step.phase)!.push(r)
    }
    return PHASES.filter((p) => byPhase.has(p)).map((phase) => {
      const items = byPhase
        .get(phase)!
        .sort((a, b) => a.wbs.localeCompare(b.wbs, undefined, { numeric: true }))
      const start = Math.min(...items.map((i) => i.task.start))
      const finish = Math.max(...items.map((i) => i.task.finish))
      const work = items.reduce((s, i) => s + i.duration, 0)
      const done = items.reduce((s, i) => s + (i.duration * i.progress) / 100, 0)
      return {
        phase,
        wbs: PHASE_WBS.get(phase) ?? '?',
        items,
        start,
        finish,
        /** 階段跨距（含等待），與各步驟工期總和不同 */
        span: finish - start,
        work,
        progress: work ? Math.round((done / work) * 100) : 0,
        critical: items.some((i) => i.task.critical),
      }
    })
  })

  const curveRows = computed<CurveRow[]>(() =>
    rows.value.map((r) => ({
      duration: r.duration,
      start: r.task.start,
      finish: r.task.finish,
      lateStart: r.task.lateStart,
      lateFinish: r.task.lateFinish,
      progress: r.progress,
    })),
  )

  /** 計畫值曲線：最早開始與最晚開始各一條，兩者之間即香蕉包絡 */
  const plannedEarly = computed(() => plannedCurve(curveRows.value, projectDays.value, 'early'))
  const plannedLate = computed(() => plannedCurve(curveRows.value, projectDays.value, 'late'))
  const currentEarned = computed(() => earnedPct(curveRows.value))

  /**
   * 資料日期：進度模擬開著就用游標，否則用今天。
   * 今天早於開工日時取 0，晚於完工日時取完工日。
   */
  const dataDay = computed(() => {
    if (cursorDay.value !== null) return cursorDay.value
    const days = Math.floor(
      (Date.now() - projectStartDate.value.getTime()) / 86_400_000,
    )
    return Math.min(Math.max(days, 0), Math.ceil(projectDays.value))
  })

  /** 記錄一筆進度快照；同一天只保留最後一次 */
  function logProgress(): void {
    const day = dataDay.value
    const pct = currentEarned.value
    const rest = progressLog.value.filter((s) => s.day !== day)
    progressLog.value = [...rest, { day, pct }].sort((a, b) => a.day - b.day)
  }

  function clearProgressLog(): void {
    progressLog.value = []
  }

  /** 要徑上的變異數總和與期望完工日 —— PERT 的標準做法 */
  const pertSummary = computed(() => {
    const critical = rows.value.filter((r) => r.task.critical)
    const varianceSum = critical.reduce((s, r) => s + r.variance, 0)
    return {
      expectedDays: schedule.value.projectDays,
      varianceSum,
      stdDev: stdDev(varianceSum),
      criticalCount: critical.length,
      probabilityWithin: (days: number) =>
        completionProbability(days, schedule.value.projectDays, varianceSum),
    }
  })

  const projectStartDate = computed(() => {
    const [y, m, d] = projectStart.value.split('-').map(Number)
    return new Date(y, (m ?? 1) - 1, d ?? 1)
  })

  /** 游標當下已完工的步驟 id；模擬關閉時為 null */
  const completedStepIds = computed(() =>
    cursorDay.value === null ? null : completedAt(schedule.value, cursorDay.value),
  )

  /** 供 3D 過濾用的構件 id；模擬關閉時為 null（顯示全部） */
  const installedPartIds = computed(() => {
    const done = completedStepIds.value
    if (!done) return null
    const ids = new Set<string>()
    for (const step of INSTALL_STEPS) {
      if (step.partId && done.has(step.id)) ids.add(step.partId)
    }
    return ids
  })

  const overallProgress = computed(() => {
    const total = rows.value.reduce((s, r) => s + r.duration, 0)
    if (!total) return 0
    const done = rows.value.reduce((s, r) => s + (r.duration * r.progress) / 100, 0)
    return Math.round((done / total) * 100)
  })

  function patch(id: string, p: StepOverride): void {
    overrides.value = { ...overrides.value, [id]: { ...overrides.value[id], ...p } }
  }

  function setPinnedStart(id: string, day: number): void {
    patch(id, { pinnedStart: Math.max(0, Math.round(day)) })
  }

  /** 改動三點估算的其中一個值，並自動維持 O ≤ M ≤ P */
  function setEstimate(id: string, field: keyof ThreePoint, days: number): void {
    const current = threePoint.value.get(id)
    if (!current) return
    const next = clampThreePoint(
      { ...current, [field]: Math.max(0, Math.round(days)) },
      field,
    )
    patch(id, { optimisticDays: next.o, durationDays: next.m, pessimisticDays: next.p })
  }

  /** 拖曳長條調整工期時改的是最可能工期 */
  function setDuration(id: string, days: number): void {
    setEstimate(id, 'm', days)
  }

  function setProgress(id: string, pct: number): void {
    patch(id, { progress: Math.min(100, Math.max(0, Math.round(pct))) })
    logProgress()
  }

  /** 清掉單一步驟的拖曳調整，回到資料檔的排程（保留完成度） */
  function resetStep(id: string): void {
    const {
      pinnedStart: _p,
      durationDays: _d,
      optimisticDays: _o,
      pessimisticDays: _q,
      ...rest
    } = overrides.value[id] ?? {}
    overrides.value = { ...overrides.value, [id]: rest }
  }

  function resetAll(): void {
    overrides.value = {}
    selectedId.value = null
  }

  watch(
    [projectStart, overrides, cursorDay, playSpeed, progressLog],
    () => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            projectStart: projectStart.value,
            overrides: overrides.value,
            cursorDay: cursorDay.value,
            playSpeed: playSpeed.value,
            progressLog: progressLog.value,
          } satisfies Persisted),
        )
      } catch {
        // 儲存空間不足或被封鎖：不影響操作，只是重整後不保留
      }
    },
    { deep: true },
  )

  return {
    projectStart,
    projectStartDate,
    overrides,
    selectedId,
    cursorDay,
    playSpeed,
    schedule,
    projectDays,
    rows,
    wbsGroups,
    plannedEarly,
    plannedLate,
    currentEarned,
    dataDay,
    progressLog,
    logProgress,
    clearProgressLog,
    pertSummary,
    threePoint,
    completedStepIds,
    installedPartIds,
    overallProgress,
    setPinnedStart,
    setDuration,
    setEstimate,
    setProgress,
    resetStep,
    resetAll,
  }
})
