/**
 * 要徑法（CPM）排程引擎。
 *
 * 全部以「距離開工日的第幾天」的整數 offset 運算，區間採半開 [start, finish)，
 * 因此 duration === finish - start，且相接的任務不會重疊或空一天。
 *
 * 日曆採連續日（含週末）。混凝土養護等待本來就是連續日，
 * 若改成工作日制，lag 的語意會與工期不一致，反而更容易算錯。
 * 週末在時間軸上以底色標示，但不跳過。
 */

/**
 * 浮時的判定容差。
 *
 * 採用 PERT 期望工期後，工期是小數（te = (O+4M+P)/6），
 * 浮時經過正推逆推的加減之後會出現 4.44e-16 這種浮點誤差。
 * 用嚴格等於零判斷要徑會讓整條要徑斷開，因此改用容差。
 */
const FLOAT_EPSILON = 1e-6

export interface TaskInput {
  id: string
  durationDays: number
  deps: string[]
  /** 本任務完成後，後續任務還需等待的天數 */
  lagDays?: number
  /** 使用者拖曳指定的最早開工日；實際開工日不會早於前置條件允許的時間 */
  pinnedStart?: number
}

export interface ScheduledTask {
  id: string
  start: number
  finish: number
  lateStart: number
  lateFinish: number
  /** 總浮時：可延遲而不影響總工期的天數 */
  float: number
  critical: boolean
}

export interface ScheduleResult {
  tasks: Map<string, ScheduledTask>
  /** 專案總天數 */
  projectDays: number
  /** 相依成環時列出環上的任務 id；正常為 null */
  cycle: string[] | null
  /** 相依指向不存在的任務時列出來，這些相依會被忽略 */
  unknownDeps: string[]
}

/** Kahn 拓撲排序；有環時回傳 null 與環上節點 */
function topoSort(tasks: TaskInput[]): { order: string[]; cycle: string[] | null } {
  const ids = new Set(tasks.map((t) => t.id))
  const indegree = new Map<string, number>()
  const successors = new Map<string, string[]>()

  for (const t of tasks) {
    indegree.set(t.id, 0)
    successors.set(t.id, [])
  }
  for (const t of tasks) {
    for (const d of t.deps) {
      if (!ids.has(d)) continue // 未知相依由呼叫端回報，這裡忽略
      successors.get(d)!.push(t.id)
      indegree.set(t.id, indegree.get(t.id)! + 1)
    }
  }

  const queue = tasks.filter((t) => indegree.get(t.id) === 0).map((t) => t.id)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const s of successors.get(id)!) {
      const n = indegree.get(s)! - 1
      indegree.set(s, n)
      if (n === 0) queue.push(s)
    }
  }

  if (order.length !== tasks.length) {
    return { order, cycle: tasks.map((t) => t.id).filter((id) => !order.includes(id)) }
  }
  return { order, cycle: null }
}

export function computeSchedule(tasks: TaskInput[]): ScheduleResult {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const unknownDeps = [
    ...new Set(tasks.flatMap((t) => t.deps.filter((d) => !byId.has(d)))),
  ]

  const { order, cycle } = topoSort(tasks)
  if (cycle) {
    return { tasks: new Map(), projectDays: 0, cycle, unknownDeps }
  }

  const start = new Map<string, number>()
  const finish = new Map<string, number>()

  // 正推：最早開工 = 所有前置的（完成日 + 該前置的 lag）取最大，再與釘選日取最大
  for (const id of order) {
    const t = byId.get(id)!
    let es = 0
    for (const d of t.deps) {
      const dep = byId.get(d)
      if (!dep) continue
      es = Math.max(es, finish.get(d)! + (dep.lagDays ?? 0))
    }
    if (t.pinnedStart !== undefined) es = Math.max(es, t.pinnedStart)
    start.set(id, es)
    finish.set(id, es + Math.max(t.durationDays, 0))
  }

  const projectDays = order.length ? Math.max(...order.map((id) => finish.get(id)!)) : 0

  // 逆推：最晚完工 = 所有後續的（最晚開工 − 本任務 lag）取最小
  const successors = new Map<string, string[]>()
  for (const id of order) successors.set(id, [])
  for (const t of tasks) {
    for (const d of t.deps) if (successors.has(d)) successors.get(d)!.push(t.id)
  }

  const lateFinish = new Map<string, number>()
  const lateStart = new Map<string, number>()
  for (const id of [...order].reverse()) {
    const t = byId.get(id)!
    const succ = successors.get(id)!
    let lf = projectDays
    if (succ.length) {
      lf = Math.min(...succ.map((s) => lateStart.get(s)! - (t.lagDays ?? 0)))
    }
    lateFinish.set(id, lf)
    lateStart.set(id, lf - Math.max(t.durationDays, 0))
  }

  const result = new Map<string, ScheduledTask>()
  for (const id of order) {
    const float = lateStart.get(id)! - start.get(id)!
    result.set(id, {
      id,
      start: start.get(id)!,
      finish: finish.get(id)!,
      lateStart: lateStart.get(id)!,
      lateFinish: lateFinish.get(id)!,
      float: Math.abs(float) < FLOAT_EPSILON ? 0 : float,
      critical: float < FLOAT_EPSILON,
    })
  }

  return { tasks: result, projectDays, cycle: null, unknownDeps }
}

/** offset 轉實際日期 */
export function dayToDate(projectStart: Date, offset: number): Date {
  const d = new Date(projectStart)
  d.setDate(d.getDate() + offset)
  d.setHours(0, 0, 0, 0)
  return d
}

/** 是否為週末（時間軸底色用） */
export function isWeekend(date: Date): boolean {
  const d = date.getDay()
  return d === 0 || d === 6
}

/** 在游標日期當下已完工的任務 id（完工日 <= 游標日） */
export function completedAt(schedule: ScheduleResult, day: number): Set<string> {
  const done = new Set<string>()
  for (const [id, t] of schedule.tasks) if (t.finish <= day) done.add(id)
  return done
}
