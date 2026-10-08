import { describe, expect, it } from 'vitest'
import { formatMoney, kopecksToInput, parseRublesToKopecks, plural, shiftMonth } from './format'

describe('money', () => {
  it('parseRublesToKopecks принимает запятую и пробелы', () => {
    expect(parseRublesToKopecks('1 234,56')).toBe(123456)
    expect(parseRublesToKopecks('0.1')).toBe(10)
    expect(parseRublesToKopecks('19.99')).toBe(1999)
    expect(parseRublesToKopecks('0')).toBeNull()
    expect(parseRublesToKopecks('1.234')).toBeNull()
    expect(parseRublesToKopecks('abc')).toBeNull()
  })

  it('formatMoney скрывает нулевые копейки', () => {
    expect(formatMoney(150000).replace(/\s/g, ' ')).toBe('1 500 ₽')
    expect(formatMoney(150050).replace(/\s/g, ' ')).toBe('1 500,50 ₽')
    expect(kopecksToInput(150050)).toBe('1500.50')
  })
})

describe('text & dates', () => {
  it('plural', () => {
    expect(plural(1, 'день', 'дня', 'дней')).toBe('день')
    expect(plural(3, 'день', 'дня', 'дней')).toBe('дня')
    expect(plural(11, 'день', 'дня', 'дней')).toBe('дней')
    expect(plural(22, 'день', 'дня', 'дней')).toBe('дня')
  })

  it('shiftMonth переходит через год', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
})
