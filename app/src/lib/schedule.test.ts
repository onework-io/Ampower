import { describe, expect, it } from 'vitest'
import { completedAt, computeSchedule, dayToDate, isWeekend, type TaskInput } from './schedule'
import { INSTALL_STEPS } from '@/data/installSteps'

const t = (id: string, durationDays: number, deps: string[] = [], extra: Partial<TaskInput> = {}): TaskInput => ({
  id,
  durationDays,
  deps,
  ...extra,
})

describe('computeSchedule 正推', () => {
  it('沒有相依的任務都從第 0 天開始', () => {
    const r = computeSchedule([t('a', 2), t('b', 3)])
    expect(r.tasks.get('a')!.start).toBe(0)
    expect(r.tasks.get('b')!.start).toBe(0)
    expect(r.projectDays).toBe(3)
  })

  it('相接的任務不重疊也不空一天', () => {
    const r = computeSchedule([t('a', 2), t('b', 3, ['a'])])
    expect(r.tasks.get('a')!.finish).toBe(2)
    expect(r.tasks.get('b')!.start).toBe(2)
    expect(r.tasks.get('b')!.finish).toBe(5)
  })

  it('多個前置取最晚者', () => {
    const r = computeSchedule([t('a', 2), t('b', 5), t('c', 1, ['a', 'b'])])
    expect(r.tasks.get('c')!.start).toBe(5)
  })

  it('lag 讓後續任務延後，但不拉長前置本身的工期', () => {
    const r = computeSchedule([t('a', 3, [], { lagDays: 7 }), t('b', 1, ['a'])])
    expect(r.tasks.get('a')!.finish).toBe(3)
    expect(r.tasks.get('b')!.start).toBe(10)
  })

  it('釘選開工日只能往後推，不能違反前置條件', () => {
    const late = computeSchedule([t('a', 2), t('b', 1, ['a'], { pinnedStart: 9 })])
    expect(late.tasks.get('b')!.start).toBe(9)

    const early = computeSchedule([t('a', 2), t('b', 1, ['a'], { pinnedStart: 0 })])
    expect(early.tasks.get('b')!.start).toBe(2)
  })

  it('工期 0 的任務視為里程碑，不佔天數', () => {
    const r = computeSchedule([t('a', 0), t('b', 2, ['a'])])
    expect(r.tasks.get('a')!.finish).toBe(0)
    expect(r.tasks.get('b')!.start).toBe(0)
  })
})

describe('computeSchedule 要徑', () => {
  it('較短的並行分支有浮時，較長的是要徑', () => {
    //  a(2) → c(1)
    //  b(5) → c
    const r = computeSchedule([t('a', 2), t('b', 5), t('c', 1, ['a', 'b'])])
    expect(r.tasks.get('b')!.critical).toBe(true)
    expect(r.tasks.get('b')!.float).toBe(0)
    expect(r.tasks.get('a')!.float).toBe(3)
    expect(r.tasks.get('a')!.critical).toBe(false)
    expect(r.tasks.get('c')!.critical).toBe(true)
  })

  it('單線任務全部都在要徑上', () => {
    const r = computeSchedule([t('a', 2), t('b', 3, ['a']), t('c', 1, ['b'])])
    for (const id of ['a', 'b', 'c']) expect(r.tasks.get(id)!.critical).toBe(true)
  })

  it('lag 也算進要徑', () => {
    const r = computeSchedule([t('a', 1, [], { lagDays: 10 }), t('b', 1, ['a']), t('c', 5)])
    // a 完成 1 + lag 10 → b 從 11 開始、12 結束；c 只到 5，故 c 有浮時
    expect(r.projectDays).toBe(12)
    expect(r.tasks.get('c')!.float).toBe(7)
  })
})

describe('computeSchedule 錯誤處理', () => {
  it('相依成環時回報環上的任務且不產生排程', () => {
    const r = computeSchedule([t('a', 1, ['b']), t('b', 1, ['a'])])
    expect(r.cycle).toEqual(['a', 'b'])
    expect(r.tasks.size).toBe(0)
  })

  it('自我相依也算成環', () => {
    const r = computeSchedule([t('a', 1, ['a'])])
    expect(r.cycle).toEqual(['a'])
  })

  it('未知的相依會被回報並忽略，不影響其他任務', () => {
    const r = computeSchedule([t('a', 2, ['nope'])])
    expect(r.unknownDeps).toEqual(['nope'])
    expect(r.cycle).toBeNull()
    expect(r.tasks.get('a')!.start).toBe(0)
  })

  it('空清單不會爆', () => {
    const r = computeSchedule([])
    expect(r.projectDays).toBe(0)
    expect(r.cycle).toBeNull()
  })
})

describe('completedAt', () => {
  it('只回傳完工日已到的任務', () => {
    const r = computeSchedule([t('a', 2), t('b', 3, ['a'])])
    expect([...completedAt(r, 0)]).toEqual([])
    expect([...completedAt(r, 2)]).toEqual(['a'])
    expect([...completedAt(r, 5)].sort()).toEqual(['a', 'b'])
  })
})

describe('dayToDate / isWeekend', () => {
  it('offset 為日曆日', () => {
    const start = new Date(2026, 8, 7) // 2026-09-07 週一
    expect(dayToDate(start, 0).getDate()).toBe(7)
    expect(dayToDate(start, 7).getDate()).toBe(14)
  })

  it('跨月正確', () => {
    const start = new Date(2026, 8, 28)
    const d = dayToDate(start, 5)
    expect(d.getMonth()).toBe(9)
    expect(d.getDate()).toBe(3)
  })

  it('辨識週末', () => {
    const mon = new Date(2026, 8, 7)
    expect(isWeekend(mon)).toBe(false)
    expect(isWeekend(dayToDate(mon, 5))).toBe(true) // 週六
    expect(isWeekend(dayToDate(mon, 6))).toBe(true) // 週日
  })
})

describe('實際的 24 步驟資料', () => {
  const r = computeSchedule(INSTALL_STEPS)

  it('沒有相依成環或未知相依', () => {
    expect(r.cycle).toBeNull()
    expect(r.unknownDeps).toEqual([])
  })

  it('24 個步驟全部排進去', () => {
    expect(r.tasks.size).toBe(24)
  })

  it('放樣是唯一從第 0 天開始的步驟', () => {
    const atZero = [...r.tasks.values()].filter((x) => x.start === 0).map((x) => x.id)
    expect(atZero).toEqual(['s03'])
  })

  it('基座養護 lag 生效：避震基座不早於放樣後 11 天', () => {
    // s03(1) → s01(3) 完成於第 4 天，養護 7 天 → s08 從第 11 天開始
    expect(r.tasks.get('s01')!.finish).toBe(4)
    expect(r.tasks.get('s08')!.start).toBe(11)
  })

  it('本體配線是最後一個步驟', () => {
    expect(r.tasks.get('s23')!.finish).toBe(r.projectDays)
  })

  it('要徑上的步驟浮時為零且串成連續的一條', () => {
    const critical = [...r.tasks.values()].filter((x) => x.critical)
    expect(critical.length).toBeGreaterThan(0)
    for (const c of critical) expect(c.float).toBe(0)
  })
})

describe('小數工期（PERT te）', () => {
  it('浮點誤差不會讓要徑斷開', () => {
    // te 這類小數在正推逆推後會產生 4.44e-16 等級的誤差
    const r = computeSchedule([
      t('a', 1 / 6),
      t('b', 19 / 6, ['a']),
      t('c', 7 / 6, ['b']),
    ])
    for (const id of ['a', 'b', 'c']) {
      expect(r.tasks.get(id)!.critical, `${id} 應在要徑上`).toBe(true)
    }
  })

  it('誤差等級的浮時歸零，不會顯示成 0.0 卻不是要徑', () => {
    const r = computeSchedule([t('a', 1 / 3), t('b', 2 / 3, ['a'])])
    expect(r.tasks.get('a')!.float).toBe(0)
  })

  it('真正有浮時的分支仍然不算要徑', () => {
    const r = computeSchedule([t('a', 1 / 6), t('b', 5), t('c', 1, ['a', 'b'])])
    expect(r.tasks.get('a')!.critical).toBe(false)
    expect(r.tasks.get('a')!.float).toBeGreaterThan(4)
    expect(r.tasks.get('b')!.critical).toBe(true)
  })

  it('小數工期的相接仍然不重疊也不空一天', () => {
    const r = computeSchedule([t('a', 7 / 6), t('b', 1, ['a'])])
    expect(r.tasks.get('b')!.start).toBeCloseTo(7 / 6, 10)
  })
})
