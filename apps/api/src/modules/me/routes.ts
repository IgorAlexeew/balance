import { Hono } from 'hono'
import type { User } from '@prisma/client'
import { meUpdateSchema, type UserDTO } from '@balance/contracts'
import { prisma } from '../../db'
import { validate } from '../../lib/validate'
import { requireUser } from '../../middleware/session'
import type { AppEnv } from '../../types'
import { rescheduleRemindersForUser } from '../reminders/service'

export function userToDTO(u: User): UserDTO {
  return { id: u.id, name: u.name, email: u.email, image: u.image, timezone: u.timezone }
}

export const meRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .get('/', (c) => c.json(userToDTO(c.get('user'))))
  .patch('/', validate('json', meUpdateSchema), async (c) => {
    const user = c.get('user')
    const input = c.req.valid('json')
    const updated = await prisma.user.update({ where: { id: user.id }, data: input })
    // Ежедневные/еженедельные напоминания считаются в зоне пользователя
    if (input.timezone && input.timezone !== user.timezone) {
      await rescheduleRemindersForUser(user.id)
    }
    return c.json(userToDTO(updated))
  })
