import { z } from 'zod'
import { idSchema } from './common.js'
import type { NotificationType } from './enums.js'

export const notificationListQuerySchema = z.object({
  unread: z
    .enum(['0', '1', 'true', 'false'])
    .optional()
    .transform((v) => v === '1' || v === 'true'),
})

export const notificationsMarkReadSchema = z
  .object({
    ids: z.array(idSchema).max(100).optional(),
    all: z.boolean().optional(),
  })
  .refine((v) => v.all === true || (v.ids?.length ?? 0) > 0, { message: 'Укажите уведомления' })
export type NotificationsMarkReadInput = z.input<typeof notificationsMarkReadSchema>

export interface NotificationDTO {
  id: string
  title: string
  body: string
  type: NotificationType
  read: boolean
  taskId: string | null
  createdAt: string
}
