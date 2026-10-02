import { createHash, randomBytes } from 'node:crypto'
import { createApp } from '../src/app'
import { loadConfig, type AppConfig } from '../src/config'
import { prisma } from '../src/db'

export const ORIGIN = 'http://localhost:5173'

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    ...loadConfig({ DATABASE_URL: 'file:./test.db', NODE_ENV: 'test', APP_URL: ORIGIN }),
    ...overrides,
  }
}

export function testApp(overrides: Partial<AppConfig> = {}) {
  return createApp(testConfig(overrides))
}

export async function createUser(name: string, timezone = 'Europe/Moscow') {
  return prisma.user.create({ data: { name, email: `${name.toLowerCase()}@test.local`, timezone } })
}

/** Создаёт сессию в БД и возвращает Cookie-заголовок */
export async function sessionCookie(userId: string): Promise<string> {
  const token = randomBytes(16).toString('hex')
  await prisma.session.create({
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
export async function clientFor(app: ReturnType<typeof testApp>, userId: string) {
  const cookie = await sessionCookie(userId)
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await app.request(`/api${path}`, {
      method,
      headers: {
        Cookie: cookie,
        Origin: ORIGIN,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const json: Json = res.headers.get('content-type')?.includes('json') ? await res.json() : null
    return { status: res.status, body: json }
  }
  return {
    get: (path: string) => call('GET', path),
    post: (path: string, body: unknown = {}) => call('POST', path, body),
    patch: (path: string, body: unknown) => call('PATCH', path, body),
    del: (path: string) => call('DELETE', path),
  }
}

export async function createGroup(ownerId: string, memberIds: string[] = []) {
  return prisma.familyGroup.create({
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
