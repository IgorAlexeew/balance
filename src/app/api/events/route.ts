import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  ApiError,
  assertGroupAccess,
  handleApiError,
  optString,
  parseIsoDate,
  reqString,
  requireUserId,
} from '@/lib/api-helpers'
import { eventToDTO } from '@/lib/dto'
import { EVENT_COLORS, type EventColor } from '@/lib/types'

export const runtime = 'nodejs'

const DAY_MS = 24 * 60 * 60 * 1000

/** GET /api/events?from=ISO&to=ISO&groupId=... — события, пересекающие диапазон */
export async function GET(req: Request) {
  try {
    const userId = await requireUserId()

    const sp = new URL(req.url).searchParams
    const groupId = sp.get('groupId')
    const fromRaw = sp.get('from')
    const toRaw = sp.get('to')

    const from = fromRaw ? parseIsoDate(fromRaw, 'from') : new Date(Date.now() - 7 * DAY_MS)
    const to = toRaw ? parseIsoDate(toRaw, 'to') : new Date(Date.now() + 45 * DAY_MS)
    if (from.getTime() >= to.getTime()) {
      throw new ApiError(400, 'Некорректный диапазон дат')
    }

    if (groupId) {
      await assertGroupAccess(userId, groupId)
    }

    const events = await db.calendarEvent.findMany({
      where: groupId
        ? { groupId, start: { lt: to }, end: { gte: from } }
        : { userId, groupId: null, start: { lt: to }, end: { gte: from } },
      include: { user: true },
      orderBy: { start: 'asc' },
    })

    return NextResponse.json(events.map(eventToDTO))
  } catch (e) {
    return handleApiError(e)
  }
}

/** POST /api/events — создать событие (личное или групповое) */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId()

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      throw new ApiError(400, 'Некорректное тело запроса')
    }

    const title = reqString(body, 'title', { min: 1, max: 200 })
    const description = optString(body, 'description', 2000)
    const start = parseIsoDate(body.start, 'start')
    const end = parseIsoDate(body.end, 'end')
    if (end.getTime() <= start.getTime()) {
      throw new ApiError(400, 'Окончание не может быть раньше начала')
    }
    const allDay = Boolean(body.allDay)
    const colorRaw = typeof body.color === 'string' ? body.color : ''
    const color: EventColor = (EVENT_COLORS as string[]).includes(colorRaw) ? (colorRaw as EventColor) : 'emerald'

    let groupId: string | null = null
    if (typeof body.groupId === 'string' && body.groupId) {
      await assertGroupAccess(userId, body.groupId)
      groupId = body.groupId
    }

    const created = await db.calendarEvent.create({
      data: { title, description, start, end, allDay, color, userId, groupId },
      include: { user: true },
    })

    return NextResponse.json(eventToDTO(created), { status: 201 })
  } catch (e) {
    return handleApiError(e)
  }
}
