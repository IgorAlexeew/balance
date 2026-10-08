import { describe, expect, it } from 'vitest'
import { describeOffset, humanizeReminder, isOverdueTask } from './labels'

const reminder = { time: null, daysOfWeek: [], offsetMinutes: null, fireAt: null, nextFireAt: null }

describe('task labels', () => {
  it('describeOffset', () => {
    expect(describeOffset(1440)).toBe('1 день')
    expect(describeOffset(120)).toBe('2 часа')
    expect(describeOffset(45)).toBe('45 минут')
  })

  it('humanizeReminder', () => {
    expect(humanizeReminder({ ...reminder, type: 'weekly', time: '18:00', daysOfWeek: [7, 1] })).toBe(
      'По Пн, Вс в 18:00',
    )
    expect(humanizeReminder({ ...reminder, type: 'before', offsetMinutes: 60 })).toBe('За 1 час до срока')
    expect(humanizeReminder(null)).toBe('Без напоминания')
  })

  it('isOverdueTask', () => {
    const now = Date.parse('2026-10-02T12:00:00Z')
    expect(isOverdueTask({ status: 'todo', deadline: '2026-10-02T11:00:00Z' }, now)).toBe(true)
    expect(isOverdueTask({ status: 'done', deadline: '2026-10-02T11:00:00Z' }, now)).toBe(false)
    expect(isOverdueTask({ status: 'todo', deadline: null }, now)).toBe(false)
  })
})
