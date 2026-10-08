import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config/app-config'
import { createUser, http, ORIGIN, sessionCookie, testApp } from './helpers'

describe('auth & security', () => {
  it('без сессии — 401 в едином формате ошибок', async () => {
    const res = await http(await testApp()).get('/api/me')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'Требуется авторизация' })
  })

  it('демо-вход недоступен в production даже при DEMO_LOGIN=true', () => {
    const config = loadConfig({ DATABASE_URL: 'file:x', NODE_ENV: 'production', DEMO_LOGIN: 'true' })
    expect(config.demoLogin).toBe(false)
  })

  it('демо-вход выключен — 404', async () => {
    const res = await http(await testApp({ demoLogin: false }))
      .post('/api/auth/demo')
      .set('Origin', ORIGIN)
      .send({})
    expect(res.status).toBe(404)
  })

  it('демо-вход ставит httpOnly SameSite=Lax cookie', async () => {
    const res = await http(await testApp({ demoLogin: true }))
      .post('/api/auth/demo')
      .set('Origin', ORIGIN)
      .send({ name: 'Тест' })
    expect(res.status).toBe(200)
    const cookie = String(res.headers['set-cookie'] ?? '')
    expect(cookie).toMatch(/lb_session=/)
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/SameSite=Lax/)
  })

  it('отклоняет изменяющие запросы с чужого Origin и не-JSON тела (CSRF)', async () => {
    const app = await testApp()
    const user = await createUser('Ivan')
    const cookie = await sessionCookie(user.id)
    const foreign = await http(app)
      .post('/api/family')
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example')
      .send({ name: 'x' })
    expect(foreign.status).toBe(403)
    const plain = await http(app)
      .post('/api/family')
      .set('Cookie', cookie)
      .set('Origin', ORIGIN)
      .set('Content-Type', 'text/plain')
      .send(JSON.stringify({ name: 'x' }))
    expect(plain.status).toBe(415)
  })

  it('битый JSON — 400 в формате API', async () => {
    const app = await testApp()
    const user = await createUser('Ivan')
    const res = await http(app)
      .post('/api/family')
      .set('Cookie', await sessionCookie(user.id))
      .set('Origin', ORIGIN)
      .set('Content-Type', 'application/json')
      .send('{"name":')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Некорректное тело запроса' })
  })

  it('logout удаляет сессию', async () => {
    const app = await testApp()
    const user = await createUser('Ivan')
    const cookie = await sessionCookie(user.id)
    const out = await http(app).post('/api/auth/logout').set('Cookie', cookie).set('Origin', ORIGIN)
    expect(out.status).toBe(200)
    const me = await http(app).get('/api/me').set('Cookie', cookie)
    expect(me.status).toBe(401)
  })
})

describe('session endpoint', () => {
  it('гость получает user: null, авторизованный — себя', async () => {
    const app = await testApp()
    const guest = await http(app).get('/api/session')
    expect(guest.status).toBe(200)
    expect(guest.body).toEqual({ user: null })

    const user = await createUser('Ivan')
    const res = await http(app)
      .get('/api/session')
      .set('Cookie', await sessionCookie(user.id))
    expect(res.body.user.id).toBe(user.id)
  })
})
