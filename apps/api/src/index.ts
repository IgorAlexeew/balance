import { serve } from '@hono/node-server'
import { createApp } from './app'
import { loadConfig } from './config'
import { prisma } from './db'
import { startReminderScheduler } from './modules/reminders/scheduler'

const config = loadConfig()
const app = createApp(config)

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port} (${config.env})`)
  if (config.demoLogin) console.log('[api] demo login is ENABLED — do not use in production')
})

const stopScheduler = startReminderScheduler(config.reminderTickMs)

const shutdown = (signal: string) => {
  console.log(`[api] ${signal} received, shutting down`)
  stopScheduler()
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0))
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
