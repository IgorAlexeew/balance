import { describe, expect, it } from 'vitest'
import { prisma } from '../src/db'
import { clientFor, createGroup, createUser, testApp } from './helpers'

describe('family', () => {
  it('владелец при выходе передаёт группу; задачи ушедшего остаются без исполнителя', async () => {
    const app = testApp()
    const [anna, boris] = await Promise.all([createUser('Anna'), createUser('Boris')])
    const group = await createGroup(anna.id, [boris.id])
    const a = await clientFor(app, anna.id)
    await a.post('/tasks', { title: 'T', groupId: group.id, assigneeId: anna.id })

    expect((await a.post(`/family/${group.id}/leave`)).status).toBe(200)
    const updated = await prisma.familyGroup.findUniqueOrThrow({ where: { id: group.id } })
    expect(updated.ownerId).toBe(boris.id)
    const task = await prisma.task.findFirstOrThrow()
    expect(task.assigneeId).toBeNull()
  })

  it('вступление по коду; повторное — 409; удалить может только владелец', async () => {
    const app = testApp()
    const [anna, boris] = await Promise.all([createUser('Anna'), createUser('Boris')])
    const a = await clientFor(app, anna.id)
    const b = await clientFor(app, boris.id)
    const { body: group } = await a.post('/family', { name: 'Дом' })
    expect(group.inviteCode).toMatch(/^[A-Z2-9]{8}$/)
    expect(group.members[0]).not.toHaveProperty('email')

    expect((await b.post('/family/join', { inviteCode: group.inviteCode.toLowerCase() })).status).toBe(200)
    expect((await b.post('/family/join', { inviteCode: group.inviteCode })).status).toBe(409)
    expect((await b.del(`/family/${group.id}`)).status).toBe(403)
  })
})

describe('budget', () => {
  it('сводка месяца считает в копейках и учитывает только нужный месяц и контекст', async () => {
    const app = testApp()
    const [anna, boris] = await Promise.all([createUser('Anna'), createUser('Boris')])
    const a = await clientFor(app, anna.id)
    const b = await clientFor(app, boris.id)

    await a.post('/transactions', { type: 'expense', amount: 10, category: 'Продукты', date: '2026-10-01' })
    await a.post('/transactions', { type: 'expense', amount: 20, category: 'Продукты', date: '2026-10-31' })
    await a.post('/transactions', {
      type: 'income',
      amount: 100_000,
      category: 'Зарплата',
      date: '2026-10-15',
    })
    await a.post('/transactions', { type: 'expense', amount: 999, category: 'Продукты', date: '2026-11-01' })
    await b.post('/transactions', { type: 'expense', amount: 777, category: 'Продукты', date: '2026-10-05' })

    const { body } = await a.get('/budget/summary?month=2026-10')
    expect(body.totalExpense).toBe(30)
    expect(body.totalIncome).toBe(100_000)
    expect(body.balance).toBe(99_970)
    expect(body.byDay).toHaveLength(31)
    expect(body.byDay[30].expense).toBe(20)

    const list = await a.get('/transactions?month=2026-10')
    expect(list.body).toHaveLength(3)
  })

  it('отклоняет дробные суммы и несуществующие даты', async () => {
    const app = testApp()
    const anna = await createUser('Anna')
    const a = await clientFor(app, anna.id)
    const fractional = await a.post('/transactions', {
      type: 'expense',
      amount: 10.5,
      category: 'X',
      date: '2026-10-01',
    })
    expect(fractional.status).toBe(400)
    const badDate = await a.post('/transactions', {
      type: 'expense',
      amount: 10,
      category: 'X',
      date: '2026-02-31',
    })
    expect(badDate.status).toBe(400)
  })

  it('ИИ-анализ без настройки провайдера — 503', async () => {
    const app = testApp({ ai: null })
    const anna = await createUser('Anna')
    const a = await clientFor(app, anna.id)
    const res = await a.post('/budget/analysis', { month: '2026-10' })
    expect(res.status).toBe(503)
  })
})
