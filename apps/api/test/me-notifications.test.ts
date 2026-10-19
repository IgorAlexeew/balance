import { describe, expect, it } from 'vitest'
import { db } from './setup'
import { clientFor, createUser, testApp } from './helpers'

describe('me', () => {
  it('профиль: чтение, изменение и пересчёт напоминаний при смене часового пояса', async () => {
    const app = await testApp()
    const anna = await createUser('Anna', 'Europe/Moscow')
    const a = await clientFor(app, anna.id)
    expect((await a.get('/me')).body).toMatchObject({ id: anna.id, name: 'Anna', timezone: 'Europe/Moscow' })

    const { body: task } = await a.post('/tasks', { title: 'T', reminder: { type: 'daily', time: '09:00' } })
    const before = Date.parse(task.reminder.nextFireAt)

    expect((await a.patch('/me', { timezone: 'Mars/Olympus' })).status).toBe(400)
    const res = await a.patch('/me', { name: 'Анна', timezone: 'Asia/Vladivostok' })
    expect(res.body).toMatchObject({ name: 'Анна', timezone: 'Asia/Vladivostok' })

    const reminder = await db.reminder.findFirstOrThrow()
    // 09:00 во Владивостоке на 7 часов раньше 09:00 в Москве (по модулю суток)
    const diffHours = ((((reminder.nextFireAt!.getTime() - before) / 3_600_000) % 24) + 24) % 24
    expect(diffHours).toBe(17)
  })
})

describe('notifications', () => {
  it('список, фильтр unread и отметка прочитанными не трогают чужие', async () => {
    const app = await testApp()
    const [anna, boris] = await Promise.all([createUser('Anna'), createUser('Boris')])
    const a = await clientFor(app, anna.id)
    const note = (userId: string, title: string) =>
      db.userNotification.create({ data: { userId, title, body: '…' } })
    const n1 = await note(anna.id, 'one')
    await note(anna.id, 'two')
    const foreign = await note(boris.id, 'foreign')

    expect((await a.get('/notifications')).body).toHaveLength(2)
    expect((await a.post('/notifications/read', {})).status).toBe(400)

    await a.post('/notifications/read', { ids: [n1.id, foreign.id] })
    const unread = await a.get('/notifications?unread=1')
    expect(unread.body.map((n: { title: string }) => n.title)).toEqual(['two'])

    await a.post('/notifications/read', { all: true })
    expect((await a.get('/notifications?unread=1')).body).toEqual([])
    expect((await db.userNotification.findUniqueOrThrow({ where: { id: foreign.id } })).read).toBe(false)
  })
})
