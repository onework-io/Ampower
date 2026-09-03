import { describe, expect, it } from 'vitest'
import { formatTimecode, isValidRange, parseTimecode } from './timecode'

describe('parseTimecode', () => {
  it.each([
    ['90', 90],
    ['0', 0],
    ['1:30', 90],
    ['0:05', 5],
    ['12:00', 720],
    ['1:02:03', 3723],
    ['1h2m3s', 3723],
    ['2m', 120],
    ['45s', 45],
    ['1h', 3600],
    ['  1:30  ', 90],
    ['1H2M3S', 3723],
  ])('%s → %i 秒', (raw, expected) => {
    expect(parseTimecode(raw)).toBe(expected)
  })

  it.each(['', '   ', 'abc', '1:2:3:4', '-30', '1:99', 'm', ':30'])('%s 無法解析', (raw) => {
    expect(parseTimecode(raw)).toBeNull()
  })

  it('分秒欄位超過 59 視為無效，避免把 1:75 誤讀成 135 秒', () => {
    expect(parseTimecode('1:75')).toBeNull()
  })
})

describe('formatTimecode', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [90, '1:30'],
    [720, '12:00'],
    [3723, '1:02:03'],
    [3600, '1:00:00'],
  ])('%i 秒 → %s', (secs, expected) => {
    expect(formatTimecode(secs)).toBe(expected)
  })

  it('負數視為 0', () => {
    expect(formatTimecode(-10)).toBe('0:00')
  })

  it('小數四捨五入', () => {
    expect(formatTimecode(89.6)).toBe('1:30')
  })

  it('與 parseTimecode 互為反向', () => {
    for (const s of [0, 5, 90, 720, 3723]) {
      expect(parseTimecode(formatTimecode(s))).toBe(s)
    }
  })
})

describe('isValidRange', () => {
  it('結束晚於開始才合法', () => {
    expect(isValidRange(10, 20)).toBe(true)
    expect(isValidRange(20, 10)).toBe(false)
    expect(isValidRange(10, 10)).toBe(false)
  })

  it('只設一端或都不設都算合法', () => {
    expect(isValidRange(10, undefined)).toBe(true)
    expect(isValidRange(undefined, 20)).toBe(true)
    expect(isValidRange(undefined, undefined)).toBe(true)
  })
})
