import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { handleApiError, requireUserId } from '@/lib/api-helpers'
import { notificationToDTO } from '@/lib/dto'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const userId = await requireUserId()
    const unreadParam = new URL(req.url).searchParams.get('unread')
    const unreadOnly = unreadParam === '1' || unreadParam === 'true'

    const items = await db.userNotification.findMany({
      where: unreadOnly ? { userId, read: false } : { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json(items.map(notificationToDTO))
  } catch (e) {
    return handleApiError(e)
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await requireUserId()

    let body: Record<string, unknown>
    try {
      const parsed: unknown = await req.json()
      body = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      body = {}
    }

    const all = body['all'] === true
    const rawIds = body['ids']
    const ids = Array.isArray(rawIds)
      ? rawIds.filter((v): v is string => typeof v === 'string' && v.length > 0)
      : []

    if (all) {
      await db.userNotification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      })
    } else if (ids.length > 0) {
      // Только собственные уведомления пользователя
      await db.userNotification.updateMany({
        where: { userId, id: { in: ids } },
        data: { read: true },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}
