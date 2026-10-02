import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import type {
  CalendarEventDTO,
  EventColor,
  eventCreateSchema,
  eventListQuerySchema,
  eventUpdateSchema,
} from '@balance/contracts'
import type { z } from 'zod'
import { badRequest, notFound } from '../../common/api-error'
import { PrismaService } from '../../prisma/prisma.service'
import { AccessService } from '../access/access.service'

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

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /** События, пересекающие диапазон [from, to) */
  async list(userId: string, { from, to, groupId }: z.output<typeof eventListQuerySchema>) {
    if (groupId) await this.access.assertMember(userId, groupId)
    const events = await this.prisma.calendarEvent.findMany({
      where: {
        ...(groupId ? { groupId } : { userId, groupId: null }),
        start: { lt: new Date(to) },
        end: { gt: new Date(from) },
      },
      include: { user: true },
      orderBy: { start: 'asc' },
    })
    return events.map(eventToDTO)
  }

  async create(userId: string, { groupId, start, end, ...input }: z.output<typeof eventCreateSchema>) {
    if (groupId) await this.access.assertMember(userId, groupId)
    const created = await this.prisma.calendarEvent.create({
      data: {
        ...input,
        description: input.description ?? null,
        start: new Date(start),
        end: new Date(end),
        userId,
        groupId: groupId ?? null,
      },
      include: { user: true },
    })
    return eventToDTO(created)
  }

  async update(userId: string, id: string, { start, end, ...input }: z.output<typeof eventUpdateSchema>) {
    const event = await this.getAccessible(userId, id)
    const nextStart = start ? new Date(start) : event.start
    const nextEnd = end ? new Date(end) : event.end
    if (nextEnd.getTime() <= nextStart.getTime()) throw badRequest('Окончание должно быть позже начала')
    const updated = await this.prisma.calendarEvent.update({
      where: { id: event.id },
      data: { ...input, start: nextStart, end: nextEnd },
      include: { user: true },
    })
    return eventToDTO(updated)
  }

  async remove(userId: string, id: string) {
    const event = await this.getAccessible(userId, id)
    await this.prisma.calendarEvent.delete({ where: { id: event.id } })
  }

  private async getAccessible(userId: string, id: string) {
    const event = await this.prisma.calendarEvent.findUnique({ where: { id } })
    if (!event || !(await this.access.canAccess(userId, { ownerId: event.userId, groupId: event.groupId }))) {
      throw notFound('Событие не найдено')
    }
    return event
  }
}
