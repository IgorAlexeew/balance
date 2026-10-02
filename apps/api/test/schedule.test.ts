import { describe, expect, it } from 'vitest'
import { computeNextFireAt, type ReminderRule } from '../src/modules/reminders/schedule'

const rule = (r: Partial<ReminderRule>): ReminderRule => ({
  type: 'daily',
  time: null,
  daysOfWeek: null,
  offsetMinutes: null,
  fireAt: null,
  ...r,
})

describe('computeNextFireAt', () => {
  it('daily: сегодня, если время ещё не прошло, иначе завтра (по зоне получателя)', () => {
    const after = new Date('2026-10-02T05:00:00Z') // 08:00 в Москве (UTC+3)
    const ctx = { deadline: null, timezone: 'Europe/Moscow', after }
    expect(computeNextFireAt(rule({ time: '09:00' }), ctx)?.toISOString()).toBe('2026-10-02T06:00:00.000Z')
    expect(computeNextFireAt(rule({ time: '07:30' }), ctx)?.toISOString()).toBe('2026-10-03T04:30:00.000Z')
  })

  it('одно и то же время даёт разные моменты для разных зон', () => {
    const after = new Date('2026-10-02T00:00:00Z')
    const r = rule({ type: 'morning', time: '08:00' })
    expect(computeNextFireAt(r, { deadline: null, timezone: 'Europe/Samara', after })?.toISOString()).toBe(
      '2026-10-02T04:00:00.000Z',
    )
    expect(computeNextFireAt(r, { deadline: null, timezone: 'Asia/Yekaterinburg', after })?.toISOString()).toBe(
      '2026-10-02T03:00:00.000Z',
    )
  })

  it('weekly: ближайший подходящий день недели', () => {
    // 2026-10-02 — пятница
    const after = new Date('2026-10-02T12:00:00Z')
    const r = rule({ type: 'weekly', time: '18:00', daysOfWeek: '1,3' })
    expect(computeNextFireAt(r, { deadline: null, timezone: 'Europe/Moscow', after })?.toISOString()).toBe(
      '2026-10-05T15:00:00.000Z', // понедельник 18:00 MSK
    )
  })

  it('учитывает переход на зимнее время', () => {
    // В Берлине 25.10.2026 часы переводятся с UTC+2 на UTC+1
    const after = new Date('2026-10-24T12:00:00Z')
    const r = rule({ time: '09:00' })
    const ctx = { deadline: null, timezone: 'Europe/Berlin', after }
    const first = computeNextFireAt(r, ctx)!
    expect(first.toISOString()).toBe('2026-10-25T08:00:00.000Z')
    expect(computeNextFireAt(r, { ...ctx, after: first })?.toISOString()).toBe('2026-10-26T08:00:00.000Z')
  })

  it('разовые напоминания в прошлом больше не срабатывают', () => {
    const after = new Date('2026-10-02T12:00:00Z')
    const deadline = new Date('2026-10-02T15:00:00Z')
    const ctx = { deadline, timezone: 'UTC', after }
    expect(computeNextFireAt(rule({ type: 'at_deadline' }), ctx)).toEqual(deadline)
    expect(computeNextFireAt(rule({ type: 'before', offsetMinutes: 60 }), ctx)?.toISOString()).toBe(
      '2026-10-02T14:00:00.000Z',
    )
    expect(computeNextFireAt(rule({ type: 'before', offsetMinutes: 600 }), ctx)).toBeNull()
    expect(computeNextFireAt(rule({ type: 'once', fireAt: new Date('2026-10-01T00:00:00Z') }), ctx)).toBeNull()
    expect(computeNextFireAt(rule({ type: 'at_deadline' }), { ...ctx, deadline: null })).toBeNull()
  })
})
