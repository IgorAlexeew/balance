import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config'
import { createUser, ORIGIN, sessionCookie, testApp } from './helpers'

describe('auth & security', () => {
  it('без сессии — 401', async () => {
    const res = await testApp().request('/api/me')
    expect(res.status).toBe(401)
  })

  it('демо-вход недоступен в production даже при DEMO_LOGIN=true', () => {
    const config = loadConfig({ DATABASE_URL: 'file:x', NODE_ENV: 'production', DEMO_LOGIN: 'true' })
    expect(config.demoLogin).toBe(false)
  })

  it('демо-вход выключен — 404', async () => {
    const res = await testApp({ demoLogin: false }).request('/api/auth/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: '{}',
    })
    expect(res.status).toBe(404)
  })

  it('демо-вход ставит httpOnly SameSite=Lax cookie', async () => {
    const res = await testApp({ demoLogin: true }).request('/api/auth/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({ name: 'Тест' }),
    })
    expect(res.status).toBe(200)
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(/lb_session=/)
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/SameSite=Lax/)
  })

  it('отклоняет изменяющие запросы с чужого Origin и не-JSON тела (CSRF)', async () => {
    const app = testApp()
    const user = await createUser('Ivan')
    const cookie = await sessionCookie(user.id)
    const foreign = await app.request('/api/family', {
      method: 'POST',
      headers: { Cookie: cookie, Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x' }),
    })
    expect(foreign.status).toBe(403)
    const plain = await app.request('/api/family', {
      method: 'POST',
      headers: { Cookie: cookie, Origin: ORIGIN, 'Content-Type': 'text/plain' },
      body: JSON.stringify({ name: 'x' }),
    })
    expect(plain.status).toBe(415)
  })

  it('logout удаляет сессию', async () => {
    const app = testApp()
    const user = await createUser('Ivan')
    const cookie = await sessionCookie(user.id)
    const out = await app.request('/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: cookie, Origin: ORIGIN },
    })
    expect(out.status).toBe(200)
    const me = await app.request('/api/me', { headers: { Cookie: cookie } })
    expect(me.status).toBe(401)
  })
})

describe('session endpoint', () => {
  it('гость получает user: null, авторизованный — себя', async () => {
    const app = testApp()
    const guest = await app.request('/api/session')
    expect(guest.status).toBe(200)
    expect(await guest.json()).toEqual({ user: null })

    const user = await createUser('Ivan')
    const res = await app.request('/api/session', { headers: { Cookie: await sessionCookie(user.id) } })
    const body = (await res.json()) as { user: { id: string } }
    expect(body.user.id).toBe(user.id)
  })
})
