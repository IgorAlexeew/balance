import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { appendFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { isYandexConfigured } from '@/lib/auth'

export const runtime = 'nodejs'

const ENV_LOCAL_PATH = path.resolve(process.cwd(), '.env.local')

/**
 * GET — информация о хосте для настройки Яндекс OAuth.
 *
 * `host` — базовый URL, который NextAuth использует для OAuth-редиректов
 * (NEXTAUTH_URL, если задан, иначе Host-заголовок). Значения секретов
 * никогда не отдаются — только булев флаг yandexConfigured.
 */
export async function GET() {
  const h = await headers()
  const rawHost = h.get('host')
  const isLocal = rawHost?.startsWith('localhost') || rawHost?.startsWith('127.') || false
  const proto = h.get('x-forwarded-proto') ?? (isLocal ? 'http' : 'https')
  const observedOrigin = rawHost ? `${proto}://${rawHost}` : null

  // Заодно фиксируем входящие хосты в лог — полезно для отладки шлюза
  if (rawHost && !isLocal) {
    try {
      appendFileSync(
        '/home/z/my-project/host-capture.log',
        `${new Date().toISOString()} host=${rawHost} proto=${proto}\n`,
      )
    } catch {
      // лог необязателен — молча пропускаем
    }
  }

  return NextResponse.json({
    host: process.env.NEXTAUTH_URL ?? observedOrigin,
    serverOrigin: observedOrigin,
    yandexConfigured: isYandexConfigured,
  })
}

type SaveKeysBody = { clientId?: unknown; clientSecret?: unknown }

/** Очистка значения ключа: убрать пробелы/переносы, проверить формат. */
function sanitizeKey(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/\s+/g, '')
  if (cleaned.length < 16 || cleaned.length > 200) return null
  if (!/^[A-Za-z0-9_.-]+$/.test(cleaned)) return null
  return cleaned
}

/**
 * POST — сохраняет ClientID/ClientSecret в .env.local (только эти две строки,
 * остальное содержимое файла сохраняется). Значения не возвращаются в ответе
 * и не попадают в логи — ассистент их не видит. После записи Next.js в dev-режиме
 * сам перезагружает env-файлы, и провайдер Яндекса активируется.
 */
export async function POST(request: Request) {
  let body: SaveKeysBody
  try {
    body = (await request.json()) as SaveKeysBody
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 })
  }

  const clientId = sanitizeKey(body.clientId)
  const clientSecret = sanitizeKey(body.clientSecret)
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error:
          'Проверьте ключи: обычно это 32 символа (буквы a–f и цифры), без пробелов и кавычек',
      },
      { status: 400 },
    )
  }

  try {
    let lines: string[] = []
    try {
      lines = (await readFile(ENV_LOCAL_PATH, 'utf8')).split('\n')
    } catch {
      // файла ещё нет — создадим с нуля
    }

    let sawId = false
    let sawSecret = false
    const updated = lines.map((line) => {
      if (/^\s*(export\s+)?YANDEX_CLIENT_ID\s*=/.test(line)) {
        sawId = true
        return `YANDEX_CLIENT_ID=${clientId}`
      }
      if (/^\s*(export\s+)?YANDEX_CLIENT_SECRET\s*=/.test(line)) {
        sawSecret = true
        return `YANDEX_CLIENT_SECRET=${clientSecret}`
      }
      return line
    })
    if (!sawId) updated.push(`YANDEX_CLIENT_ID=${clientId}`)
    if (!sawSecret) updated.push(`YANDEX_CLIENT_SECRET=${clientSecret}`)

    let content = updated.join('\n')
    if (!content.endsWith('\n')) content += '\n'
    await writeFile(ENV_LOCAL_PATH, content, 'utf8')
  } catch {
    return NextResponse.json(
      { error: 'Не удалось записать файл .env.local на сервере' },
      { status: 500 },
    )
  }

  // Сами значения в ответ не включаем — только статус
  return NextResponse.json({ ok: true })
}
