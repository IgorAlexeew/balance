import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common'
import type { User, UserNotification } from '@prisma/client'
import {
  notificationListQuerySchema,
  notificationsMarkReadSchema,
  type NotificationDTO,
  type NotificationType,
} from '@balance/contracts'
import type { z } from 'zod'
import { CurrentUser } from '../../common/decorators'
import { ZodPipe } from '../../common/zod.pipe'
import { PrismaService } from '../../prisma/prisma.service'

function notificationToDTO(n: UserNotification): NotificationDTO {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    type: n.type as NotificationType,
    read: n.read,
    taskId: n.taskId,
    createdAt: n.createdAt.toISOString(),
  }
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @CurrentUser() user: User,
    @Query(new ZodPipe(notificationListQuerySchema)) q: z.output<typeof notificationListQuerySchema>,
  ): Promise<NotificationDTO[]> {
    const items = await this.prisma.userNotification.findMany({
      where: q.unread ? { userId: user.id, read: false } : { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return items.map(notificationToDTO)
  }

  @Post('read')
  @HttpCode(200)
  async markRead(
    @CurrentUser() user: User,
    @Body(new ZodPipe(notificationsMarkReadSchema)) input: z.output<typeof notificationsMarkReadSchema>,
  ) {
    await this.prisma.userNotification.updateMany({
      where: input.all ? { userId: user.id, read: false } : { userId: user.id, id: { in: input.ids ?? [] } },
      data: { read: true },
    })
    return { ok: true }
  }
}
