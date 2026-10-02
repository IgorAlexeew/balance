import { describe, expect, it } from 'vitest'
import {
  eventCreateSchema,
  familyJoinSchema,
  reminderInputSchema,
  taskUpdateSchema,
  transactionCreateSchema,
} from './index.js'

describe('contracts', () => {
  it('weekly: дни недели нормализуются и не могут быть пустыми', () => {
    const parsed = reminderInputSchema.parse({ type: 'weekly', time: '09:00', daysOfWeek: [5, 1, 5] })
    expect(parsed).toEqual({ type: 'weekly', time: '09:00', daysOfWeek: [1, 5] })
    expect(reminderInputSchema.safeParse({ type: 'weekly', time: '09:00', daysOfWeek: [] }).success).toBe(
      false,
    )
    expect(reminderInputSchema.safeParse({ type: 'daily', time: '24:00' }).success).toBe(false)
  })

  it('update: отсутствующее поле — undefined, пустое — null', () => {
    expect(taskUpdateSchema.parse({}).description).toBeUndefined()
    expect(taskUpdateSchema.parse({ description: '   ' }).description).toBeNull()
    expect(taskUpdateSchema.parse({ groupId: '' }).groupId).toBeNull()
  })

  it('операции: сумма — целые копейки, дата — существующая', () => {
    const base = { type: 'expense', category: 'Продукты', date: '2026-10-02' }
    expect(transactionCreateSchema.safeParse({ ...base, amount: 1999 }).success).toBe(true)
    expect(transactionCreateSchema.safeParse({ ...base, amount: 19.99 }).success).toBe(false)
    expect(transactionCreateSchema.safeParse({ ...base, amount: 100, date: '2026-02-30' }).success).toBe(
      false,
    )
  })

  it('события: окончание позже начала', () => {
    const r = eventCreateSchema.safeParse({
      title: 'x',
      start: '2026-10-02T10:00:00Z',
      end: '2026-10-02T09:00:00Z',
    })
    expect(r.success).toBe(false)
  })

  it('код приглашения приводится к верхнему регистру', () => {
    expect(familyJoinSchema.parse({ inviteCode: ' abcd2345 ' }).inviteCode).toBe('ABCD2345')
    expect(familyJoinSchema.safeParse({ inviteCode: 'ABC0' }).success).toBe(false)
  })
})
