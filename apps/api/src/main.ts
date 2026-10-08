import { Logger } from '@nestjs/common'
import { createApp } from './bootstrap'
import { loadConfig } from './config/app-config'

// Локальный .env (переменные окружения процесса имеют приоритет)
try {
  process.loadEnvFile('.env')
} catch {
  // файла нет — используем только окружение
}

async function main() {
  const config = loadConfig()
  const app = await createApp(config)
  await app.listen(config.port)
  const logger = new Logger('Bootstrap')
  logger.log(`API listening on http://localhost:${config.port} (${config.env})`)
  if (config.demoLogin) logger.warn('Demo login is ENABLED — do not use in production')
}

void main()
