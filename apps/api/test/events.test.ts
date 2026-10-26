import { describe, expect, it } from 'vitest'
import { clientFor, createGroup, createUser, testApp } from './helpers'

const event = (start: string, end: string, extra: object = {}) => ({ title: 'E', start, end, ...extra })

describe('events', () => {
  it('выборка по пересечению диапазона [from, to)', async () => {
    const app = await testApp()
    const anna = await createUser('Anna')
    const a = await clientFor(app, anna.id)
    await a.post('/events', event('2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z', { title: 'до' }))
    await a.post('/events', event('2026-10-01T23:00:00Z', '2026-10-02T01:00:00Z', { title: 'через границу' }))
    await a.post('/events', event('2026-10-02T12:00:00Z', '2026-10-02T13:00:00Z', { title: 'внутри' }))
    await a.post('/events', event('2026-10-03T00:00:00Z', '2026-10-03T01:00:00Z', { title: 'после' }))

    const res = await a.get('/events?from=2026-10-02T00:00:00Z&to=2026-10-03T00:00:00Z')
    expect(res.status).toBe(200)
    expect(res.body.map((e: { title: string }) => e.title)).toEqual(['через границу', 'внутри'])
  })

  it('PATCH проверяет end > start с учётом сохранённых значений', async () => {
    const app = await testApp()
    const anna = await createUser('Anna')
    const a = await clientFor(app, anna.id)
    const { body: e } = await a.post('/events', event('2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z'))

    expect((await a.patch(`/events/${e.id}`, { end: '2026-10-01T09:00:00Z' })).status).toBe(400)
    const ok = await a.patch(`/events/${e.id}`, { end: '2026-10-01T12:00:00Z', color: 'teal' })
    expect(ok.status).toBe(200)
    expect(ok.body).toMatchObject({ end: '2026-10-01T12:00:00.000Z', color: 'teal' })
  })

  it('личные события недоступны другим, групповые — видны участникам', async () => {
    const app = await testApp()
    const [anna, boris, eve] = await Promise.all([createUser('Anna'), createUser('Boris'), createUser('Eve')])
    const group = await createGroup(anna.id, [boris.id])
    const a = await clientFor(app, anna.id)
    const b = await clientFor(app, boris.id)
    const e = await clientFor(app, eve.id)
    const range = 'from=2026-10-01T00:00:00Z&to=2026-10-02T00:00:00Z'

    const { body: personal } = await a.post('/events', event('2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z'))
    const { body: shared } = await a.post(
      '/events',
      event('2026-10-01T12:00:00Z', '2026-10-01T13:00:00Z', { groupId: group.id }),
    )

    expect((await b.get(`/events?${range}`)).body).toEqual([])
    expect((await b.patch(`/events/${personal.id}`, { title: 'x' })).status).toBe(404)
    expect(
      (await b.get(`/events?${range}&groupId=${group.id}`)).body.map((x: { id: string }) => x.id),
    ).toEqual([shared.id])
    expect((await b.del(`/events/${shared.id}`)).status).toBe(200)
    expect((await e.get(`/events?${range}&groupId=${group.id}`)).status).toBe(404)
  })
})
