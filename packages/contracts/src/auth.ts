import { z } from 'zod'
import { timeZoneSchema } from './common'

export interface UserDTO {
  id: string
  name: string | null
  email: string | null
  image: string | null
  timezone: string
}

/** Какие возможности включены на сервере */
export interface AppConfigDTO {
  auth: { yandex: boolean; demo: boolean }
  features: { aiAnalysis: boolean }
}

export const demoLoginSchema = z.object({
  name: z.string().trim().max(40).optional(),
})
export type DemoLoginInput = z.input<typeof demoLoginSchema>

export const meUpdateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  timezone: timeZoneSchema.optional(),
})
export type MeUpdateInput = z.input<typeof meUpdateSchema>
