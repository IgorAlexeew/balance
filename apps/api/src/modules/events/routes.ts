import { Hono } from 'hono'
import type { Prisma } from '@prisma/client'
import {
  eventCreateSchema,
  eventListQuerySchema,
  eventUpdateSchema,
  idSchema,
  type CalendarEventDTO,
  type EventColor,
} from '@balance/contracts'
import { z } from 'zod'
import { prisma } from '../../db'
import { badRequest, notFound } from '../../lib/errors'
import { validate } from '../../lib/validate'
import { requireUser } from '../../middleware/session'
import type { AppEnv } from '../../types'
import { assertGroupMember, canAccessOwned } from '../access'

type EventWithUser = Prisma.CalendarEventGetPayload<{ include: { user: true } }>

function eventToDTO(e: EventWithUser): CalendarEventDTO {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    start: e.start.toISOString(),
    end: e.end.toISOString(),
    allDay: e.allDay,
    color: e.color as EventColor,
    userId: e.userId,
    userName: e.user.name,
    groupId: e.groupId,
    createdAt: e.createdAt.toISOString(),
  }
}

const idParam = z.object({ id: idSchema })

async function getAccessibleEvent(userId: string, id: string) {
  const event = await prisma.calendarEvent.findUnique({ where: { id } })
  if (!event || !(await canAccessOwned(userId, { ownerId: event.userId, groupId: event.groupId }))) {
    throw notFound('Событие не найдено')
  }
  return event
}

export const eventRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .get('/', validate('query', eventListQuerySchema), async (c) => {
    const user = c.get('user')
    const { from, to, groupId } = c.req.valid('query')
    if (groupId) await assertGroupMember(user.id, groupId)
    const events = await prisma.calendarEvent.findMany({
      where: {
        ...(groupId ? { groupId } : { userId: user.id, groupId: null }),
        start: { lt: new Date(to) },
        end: { gt: new Date(from) },
      },
      include: { user: true },
      orderBy: { start: 'asc' },
    })
    return c.json(events.map(eventToDTO))
  })

  .post('/', validate('json', eventCreateSchema), async (c) => {
    const user = c.get('user')
    const { groupId, start, end, ...input } = c.req.valid('json')
    if (groupId) await assertGroupMember(user.id, groupId)
    const created = await prisma.calendarEvent.create({
      data: {
        ...input,
        description: input.description ?? null,
        start: new Date(start),
        end: new Date(end),
        userId: user.id,
        groupId: groupId ?? null,
      },
      include: { user: true },
    })
    return c.json(eventToDTO(created), 201)
  })

  .patch('/:id', validate('param', idParam), validate('json', eventUpdateSchema), async (c) => {
    const event = await getAccessibleEvent(c.get('user').id, c.req.valid('param').id)
    const { start, end, ...input } = c.req.valid('json')
    const nextStart = start ? new Date(start) : event.start
    const nextEnd = end ? new Date(end) : event.end
    if (nextEnd.getTime() <= nextStart.getTime()) throw badRequest('Окончание должно быть позже начала')
    const updated = await prisma.calendarEvent.update({
      where: { id: event.id },
      data: { ...input, start: nextStart, end: nextEnd },
      include: { user: true },
    })
    return c.json(eventToDTO(updated))
  })

  .delete('/:id', validate('param', idParam), async (c) => {
    const event = await getAccessibleEvent(c.get('user').id, c.req.valid('param').id)
    await prisma.calendarEvent.delete({ where: { id: event.id } })
    return c.json({ ok: true })
  })
