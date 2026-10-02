import { loadConfig } from '../config'
import { prisma } from '../db'
import { ensureDemoUser } from '../seed/demo'

const config = loadConfig()
if (config.env === 'production') {
  console.error('Сид демо-данных запрещён в production')
  process.exit(1)
}

const user = await ensureDemoUser(null, config.defaultTimezone)
console.log(`Демо-данные готовы: ${user.name} <${user.email}>`)
await prisma.$disconnect()
