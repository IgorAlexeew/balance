import { PrismaClient } from '@prisma/client'
import { loadConfig } from '../config/app-config'
import { ensureDemoUser } from '../seed/demo'

async function main() {
  const config = loadConfig()
  if (config.env === 'production') throw new Error('Сид демо-данных запрещён в production')
  const prisma = new PrismaClient()
  try {
    const user = await ensureDemoUser(prisma, null, config.defaultTimezone)
    console.log(`Демо-данные готовы: ${user.name} <${user.email}>`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
