import { z } from 'zod'
import { optionalText, requiredText } from './common'
import type { MemberRole } from './enums'

export const INVITE_CODE_LENGTH = 8
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const familyCreateSchema = z.object({
  name: requiredText(60, 'Название'),
  description: optionalText(300),
})
export type FamilyCreateInput = z.input<typeof familyCreateSchema>

export const familyJoinSchema = z.object({
  inviteCode: z
    .string({ error: 'Введите код приглашения' })
    .trim()
    .toUpperCase()
    .regex(
      new RegExp(`^[${INVITE_CODE_ALPHABET}]{6,${INVITE_CODE_LENGTH}}$`),
      'Некорректный код приглашения',
    ),
})
export type FamilyJoinInput = z.input<typeof familyJoinSchema>

export interface FamilyMemberDTO {
  id: string
  userId: string
  name: string | null
  image: string | null
  role: MemberRole
  joinedAt: string
}

export interface FamilyGroupDTO {
  id: string
  name: string
  description: string | null
  inviteCode: string
  ownerId: string
  createdAt: string
  members: FamilyMemberDTO[]
}
