import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from './setup'
import { clientFor, createGroup, createUser, testApp } from './helpers'

describe('family', () => {
  it('владелец при выходе передаёт группу; задачи ушедшего остаются без исполнителя', async () => {
    const app = await testApp()
    const [anna, boris] = await Promise.all([createUser('Anna'), createUser('Boris')])
    const group = await createGroup(anna.id, [boris.id])
    const a = await clientFor(app, anna.id)
    await a.post('/tasks', { title: 'T', groupId: group.id, assigneeId: anna.id })

    expect((await a.post(`/family/${group.id}/leave`)).status).toBe(200)
    const updated = await db.familyGroup.findUniqueOrThrow({ where: { id: group.id } })
    expect(updated.ownerId).toBe(boris.id)
    const task = await db.task.findFirstOrThrow()
    expect(task.assigneeId).toBeNull()
  })

  it('после выхода исполнителя напоминание пересчитывается по часовому поясу автора', async () => {
    const app = await testApp()
    const anna = await createUser('Anna', 'Europe/Moscow')
    const boris = await createUser('Boris', 'Asia/Vladivostok')
    const group = await createGroup(anna.id, [boris.id])
    const a = await clientFor(app, anna.id)
    const b = await clientFor(app, boris.id)
    const { body: task } = await a.post('/tasks', {
      title: 'T',
      groupId: group.id,
      assigneeId: boris.id,
      reminder: { type: 'daily', time: '09:00' },
    })
    // 09:00 во Владивостоке = 02:00 по Москве (UTC 23:00)
    expect(new Date(task.reminder.nextFireAt).getUTCHours()).toBe(23)

    await b.post(`/family/${group.id}/leave`)
    const reminder = await db.reminder.findFirstOrThrow()
    // Получатель теперь автор: 09:00 по Москве = 06:00 UTC
    expect(reminder.nextFireAt!.getUTCHours()).toBe(6)
  })

  it('вступление по коду; повторное — 409; удалить может только владелец', async () => {
    const app = await testApp()
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
    const app = await testApp()
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
    const app = await testApp()
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
    const app = await testApp({ ai: null })
    const anna = await createUser('Anna')
    const a = await clientFor(app, anna.id)
    const res = await a.post('/budget/analysis', { month: '2026-10' })
    expect(res.status).toBe(503)
  })

  describe('ИИ-анализ с подменённым провайдером', () => {
    const ai = { url: 'https://ai.test/v1', apiKey: 'k', model: 'm' }
    afterEach(() => vi.unstubAllGlobals())

    it('отправляет операции месяца и возвращает ответ; без записей — 400; ошибка провайдера — 502', async () => {
      const app = await testApp({ ai })
      const anna = await createUser('Anna')
      const a = await clientFor(app, anna.id)
      const fetchMock = vi.fn(async () => Response.json({ choices: [{ message: { content: ' Разбор ' } }] }))
      vi.stubGlobal('fetch', fetchMock)

      expect((await a.post('/budget/analysis', { month: '2026-10' })).status).toBe(400)

      await a.post('/transactions', { type: 'expense', amount: 12_300, category: 'Кафе', date: '2026-10-02' })
      const res = await a.post('/budget/analysis', { month: '2026-10' })
      expect(res.body).toEqual({ analysis: 'Разбор' })
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
      expect(url).toBe('https://ai.test/v1/chat/completions')
      expect(String(init.body)).toContain('Расходы: 123 руб.')
      expect(String(init.body)).toContain('Кафе')

      fetchMock.mockResolvedValueOnce(new Response('down', { status: 500 }))
      expect((await a.post('/budget/analysis', { month: '2026-10' })).status).toBe(502)
    })

    it('итоги в запросе к ИИ считаются по всем операциям месяца, а не по первой 1000', async () => {
      const app = await testApp({ ai })
      const anna = await createUser('Anna')
      const a = await clientFor(app, anna.id)
      const fetchMock = vi.fn(async () => Response.json({ choices: [{ message: { content: 'ok' } }] }))
      vi.stubGlobal('fetch', fetchMock)
      await db.transaction.createMany({
        data: Array.from({ length: 1001 }, () => ({
          type: 'expense',
          amount: 10_000,
          category: 'Кафе',
          date: '2026-10-02',
          userId: anna.id,
        })),
      })

      expect((await a.post('/budget/analysis', { month: '2026-10' })).status).toBe(200)
      const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
      expect(String(init.body)).toContain('Записей: 1001')
      expect(String(init.body)).toContain('Расходы: 100100 руб.')
    })
  })
})
