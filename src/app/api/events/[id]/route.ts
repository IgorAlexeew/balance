import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  ApiError,
  handleApiError,
  optString,
  parseIdParam,
  parseIsoDate,
  reqString,
  requireUserId,
} from '@/lib/api-helpers'
import { eventToDTO, type EventWithUser } from '@/lib/dto'
import { EVENT_COLORS, type EventColor } from '@/lib/types'

export const runtime = 'nodejs'

/**
 * Находит событие и проверяет доступ: владелец события ИЛИ член группы события.
 * Иначе — 404 «Событие не найдено».
 */
async function getAccessibleEvent(userId: string, id: string): Promise<EventWithUser> {
  const event = await db.calendarEvent.findUnique({ where: { id }, include: { user: true } })
  if (!event) throw new ApiError(404, 'Событие не найдено')
  if (event.userId === userId) return event
  if (event.groupId) {
    const membership = await db.familyMember.findFirst({ where: { groupId: event.groupId, userId } })
    if (membership) return event
  }
  throw new ApiError(404, 'Событие не найдено')
}

/** PATCH /api/events/[id] — частичное обновление события */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId()
    const id = parseIdParam(await params)
    const event = await getAccessibleEvent(userId, id)

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      throw new ApiError(400, 'Некорректное тело запроса')
    }

    const data: { title?: string; description?: string | null; start?: Date; end?: Date; allDay?: boolean; color?: EventColor } = {}

    if (body.title !== undefined) {
      data.title = reqString(body, 'title', { min: 1, max: 200 })
    }
    if (body.description !== undefined) {
      data.description = optString(body, 'description', 2000)
    }
    if (body.start !== undefined) {
      data.start = parseIsoDate(body.start, 'start')
    }
    if (body.end !== undefined) {
      data.end = parseIsoDate(body.end, 'end')
    }
    if (data.start || data.end) {
      const start = data.start ?? event.start
      const end = data.end ?? event.end
      if (end.getTime() <= start.getTime()) {
        throw new ApiError(400, 'Окончание не может быть раньше начала')
      }
    }
    if (body.allDay !== undefined) {
      data.allDay = Boolean(body.allDay)
    }
    if (body.color !== undefined) {
      const colorRaw = typeof body.color === 'string' ? body.color : ''
      data.color = (EVENT_COLORS as string[]).includes(colorRaw) ? (colorRaw as EventColor) : 'emerald'
    }

    const updated = await db.calendarEvent.update({
      where: { id },
      data,
      include: { user: true },
    })

    return NextResponse.json(eventToDTO(updated))
  } catch (e) {
    return handleApiError(e)
  }
}

/** DELETE /api/events/[id] — удалить событие */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId()
    const id = parseIdParam(await params)
    const event = await getAccessibleEvent(userId, id)

    await db.calendarEvent.delete({ where: { id: event.id } })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}
