import { afterAll, beforeEach } from 'vitest'
import { prisma } from '../src/db'

beforeEach(async () => {
  await prisma.userNotification.deleteMany()
  await prisma.reminder.deleteMany()
  await prisma.task.deleteMany()
  await prisma.transaction.deleteMany()
  await prisma.calendarEvent.deleteMany()
  await prisma.familyMember.deleteMany()
  await prisma.familyGroup.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})
