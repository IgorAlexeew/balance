import { createHash, randomBytes } from 'node:crypto'
import type { NestExpressApplication } from '@nestjs/platform-express'
import request from 'supertest'
import { afterEach } from 'vitest'
import { createApp } from '../src/bootstrap'
import { loadConfig, type AppConfig } from '../src/config/app-config'
import { db } from './setup'

export const ORIGIN = 'http://localhost:5173'

const openApps: NestExpressApplication[] = []
afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()))
})

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    ...loadConfig({ DATABASE_URL: 'file:./test.db', NODE_ENV: 'test', APP_URL: ORIGIN }),
    ...overrides,
  }
}

export async function testApp(overrides: Partial<AppConfig> = {}) {
  const app = await createApp(testConfig(overrides))
  openApps.push(app)
  return app
}

export function http(app: NestExpressApplication) {
  return request(app.getHttpServer())
}

export async function createUser(name: string, timezone = 'Europe/Moscow') {
  return db.user.create({ data: { name, email: `${name.toLowerCase()}@test.local`, timezone } })
}

/** Создаёт сессию в БД и возвращает Cookie-заголовок */
export async function sessionCookie(userId: string): Promise<string> {
  const token = randomBytes(16).toString('hex')
  await db.session.create({
    data: {
      tokenHash: createHash('sha256').update(token).digest('hex'),
      userId,
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  })
  return `lb_session=${token}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any

/** Клиент API от имени пользователя */
export async function clientFor(app: NestExpressApplication, userId: string) {
  const cookie = await sessionCookie(userId)
  const call = async (method: 'get' | 'post' | 'patch' | 'delete', path: string, body?: unknown) => {
    let req = http(app)[method](`/api${path}`).set('Cookie', cookie).set('Origin', ORIGIN)
    if (body !== undefined) req = req.send(body as object)
    const res = await req
    return { status: res.status, body: res.body as Json }
  }
  return {
    get: (path: string) => call('get', path),
    post: (path: string, body: unknown = {}) => call('post', path, body),
    patch: (path: string, body: unknown) => call('patch', path, body),
    del: (path: string) => call('delete', path),
  }
}

export async function createGroup(ownerId: string, memberIds: string[] = []) {
  return db.familyGroup.create({
    data: {
      name: 'Семья',
      inviteCode: randomBytes(4).toString('hex').toUpperCase(),
      ownerId,
      members: {
        create: [
          { userId: ownerId, role: 'owner' },
          ...memberIds.map((userId) => ({ userId, role: 'member' })),
        ],
      },
    },
  })
}
