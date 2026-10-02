import { Hono } from 'hono'
import type { UserNotification } from '@prisma/client'
import {
  notificationListQuerySchema,
  notificationsMarkReadSchema,
  type NotificationDTO,
  type NotificationType,
} from '@balance/contracts'
import { prisma } from '../../db'
import { validate } from '../../lib/validate'
import { requireUser } from '../../middleware/session'
import type { AppEnv } from '../../types'

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

export const notificationRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .get('/', validate('query', notificationListQuerySchema), async (c) => {
    const userId = c.get('user').id
    const { unread } = c.req.valid('query')
    const items = await prisma.userNotification.findMany({
      where: unread ? { userId, read: false } : { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return c.json(items.map(notificationToDTO))
  })

  .post('/read', validate('json', notificationsMarkReadSchema), async (c) => {
    const userId = c.get('user').id
    const { all, ids } = c.req.valid('json')
    await prisma.userNotification.updateMany({
      where: all ? { userId, read: false } : { userId, id: { in: ids ?? [] } },
      data: { read: true },
    })
    return c.json({ ok: true })
  })
