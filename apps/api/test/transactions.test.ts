import { describe, expect, it } from 'vitest'
import { db } from './setup'
import { clientFor, createGroup, createUser, testApp } from './helpers'

const expense = (extra: object = {}) => ({
  type: 'expense',
  amount: 500,
  category: 'Продукты',
  date: '2026-10-05',
  ...extra,
})

describe('transactions', () => {
  it('изменение и удаление своей операции', async () => {
    const app = await testApp()
    const anna = await createUser('Anna')
    const a = await clientFor(app, anna.id)
    const { body: t } = await a.post('/transactions', expense())

    const updated = await a.patch(`/transactions/${t.id}`, { amount: 700, description: 'Рынок' })
    expect(updated.body).toMatchObject({ amount: 700, description: 'Рынок', userName: 'Anna' })
    expect((await a.del(`/transactions/${t.id}`)).status).toBe(200)
    expect(await db.transaction.count()).toBe(0)
  })

  it('чужая личная операция — 404, групповая доступна участникам', async () => {
    const app = await testApp()
    const [anna, boris, eve] = await Promise.all([createUser('Anna'), createUser('Boris'), createUser('Eve')])
    const group = await createGroup(anna.id, [boris.id])
    const a = await clientFor(app, anna.id)
    const b = await clientFor(app, boris.id)
    const e = await clientFor(app, eve.id)

    const { body: personal } = await a.post('/transactions', expense())
    const { body: shared } = await a.post('/transactions', expense({ groupId: group.id }))

    expect((await b.patch(`/transactions/${personal.id}`, { amount: 1 })).status).toBe(404)
    expect((await b.del(`/transactions/${personal.id}`)).status).toBe(404)
    expect((await b.get('/transactions?month=2026-10')).body).toEqual([])

    const list = await b.get(`/transactions?month=2026-10&groupId=${group.id}`)
    expect(list.body.map((t: { id: string }) => t.id)).toEqual([shared.id])
    expect((await b.patch(`/transactions/${shared.id}`, { amount: 1 })).status).toBe(200)
    expect((await e.get(`/transactions?month=2026-10&groupId=${group.id}`)).status).toBe(404)
    expect((await e.post('/transactions', expense({ groupId: group.id }))).status).toBe(404)
  })
})
