import { PrismaClient } from '@prisma/client'
import { afterAll, beforeEach } from 'vitest'

/** Отдельный клиент для очистки и проверок состояния БД в тестах */
export const db = new PrismaClient()

beforeEach(async () => {
  // Порядок важен из-за внешних ключей без каскада
  await db.userNotification.deleteMany()
  await db.reminder.deleteMany()
  await db.task.deleteMany()
  await db.transaction.deleteMany()
  await db.calendarEvent.deleteMany()
  await db.familyMember.deleteMany()
  await db.familyGroup.deleteMany()
  await db.session.deleteMany()
  await db.account.deleteMany()
  await db.user.deleteMany()
})

afterAll(async () => {
  await db.$disconnect()
})
