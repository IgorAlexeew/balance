import type { User } from '@prisma/client'
import type { AppConfig } from './config'

export interface AppEnv {
  Variables: {
    config: AppConfig
    /** Пользователь сессии; гарантирован после requireUser */
    user: User
    sessionTokenHash: string | null
  }
}
