import { describe, expect, it } from 'vitest'
import { db } from './setup'
import { RemindersScheduler } from '../src/modules/reminders/reminders.scheduler'
import { clientFor, createGroup, createUser, testApp } from './helpers'

describe('tasks', () => {
  it('личная задача недоступна другим пользователям', async () => {
    const app = await testApp()
    const [anna, boris] = await Promise.all([createUser('Anna'), createUser('Boris')])
    const a = await clientFor(app, anna.id)
    const b = await clientFor(app, boris.id)

    const created = await a.post('/tasks', { title: 'Личное' })
    expect(created.status).toBe(201)
    const id = created.body.id

    expect((await b.get('/tasks?scope=all')).body).toEqual([])
    expect((await b.patch(`/tasks/${id}`, { title: 'взлом' })).status).toBe(404)
    expect((await b.del(`/tasks/${id}`)).status).toBe(404)
  })

  it('групповую задачу видят участники; исполнитель — только участник группы', async () => {
    const app = await testApp()
    const [anna, boris, eve] = await Promise.all([createUser('Anna'), createUser('Boris'), createUser('Eve')])
    const group = await createGroup(anna.id, [boris.id])
    const a = await clientFor(app, anna.id)

    const bad = await a.post('/tasks', { title: 'Купить хлеб', groupId: group.id, assigneeId: eve.id })
    expect(bad.status).toBe(400)

    const ok = await a.post('/tasks', { title: 'Купить хлеб', groupId: group.id, assigneeId: boris.id })
    expect(ok.status).toBe(201)

    const b = await clientFor(app, boris.id)
    const list = await b.get(`/tasks?scope=${group.id}`)
    expect(list.body.map((t: { title: string }) => t.title)).toEqual(['Купить хлеб'])

    const e = await clientFor(app, eve.id)
    expect((await e.get(`/tasks?scope=${group.id}`)).status).toBe(403)
  })

  it('перенос в личные снимает исполнителя; completedAt не перезаписывается', async () => {
    const app = await testApp()
    const [anna, boris] = await Promise.all([createUser('Anna'), createUser('Boris')])
    const group = await createGroup(anna.id, [boris.id])
    const a = await clientFor(app, anna.id)
    const { body: task } = await a.post('/tasks', { title: 'T', groupId: group.id, assigneeId: boris.id })

    const moved = await a.patch(`/tasks/${task.id}`, { groupId: null })
    expect(moved.body.groupId).toBeNull()
    expect(moved.body.assigneeId).toBeNull()

    const done = await a.patch(`/tasks/${task.id}`, { status: 'done' })
    const again = await a.patch(`/tasks/${task.id}`, { status: 'done', title: 'T2' })
    expect(again.body.completedAt).toBe(done.body.completedAt)
  })

  it('напоминание «в срок» без срока — 400', async () => {
    const app = await testApp()
    const anna = await createUser('Anna')
    const a = await clientFor(app, anna.id)
    const res = await a.post('/tasks', { title: 'T', reminder: { type: 'at_deadline' } })
    expect(res.status).toBe(400)
  })

  it('планировщик уведомляет исполнителя ровно один раз', async () => {
    const app = await testApp()
    const [anna, boris] = await Promise.all([createUser('Anna'), createUser('Boris')])
    const group = await createGroup(anna.id, [boris.id])
    const a = await clientFor(app, anna.id)
    // Срок через 90 минут, напоминание «за 60 минут»
    const deadline = new Date(Date.now() + 90 * 60_000).toISOString()
    const scheduler = app.get(RemindersScheduler)
    const processDueReminders = (now: Date) => scheduler.processDue(now)
    const { body: task } = await a.post('/tasks', {
      title: 'Оплатить',
      groupId: group.id,
      assigneeId: boris.id,
      deadline,
      reminder: { type: 'before', offsetMinutes: 60 },
    })
    const nextFireAt = new Date(task.reminder.nextFireAt)
    expect(nextFireAt.getTime()).toBe(Date.parse(deadline) - 60 * 60_000)

    // Ещё рано
    expect(await processDueReminders(new Date())).toBe(0)

    // Наступило время: два параллельных тика не дублируют уведомление
    const now = new Date(nextFireAt.getTime() + 1000)
    const [first, second] = await Promise.all([processDueReminders(now), processDueReminders(now)])
    expect(first + second).toBe(1)
    expect(await processDueReminders(now)).toBe(0)

    const notifications = await db.userNotification.findMany()
    expect(notifications).toHaveLength(1)
    expect(notifications[0]!.userId).toBe(boris.id)
  })
})
