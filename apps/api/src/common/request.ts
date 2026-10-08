import type { User } from '@prisma/client'
import type { Request } from 'express'

export interface AppRequest extends Request {
  user?: User
  sessionTokenHash?: string | null
}
