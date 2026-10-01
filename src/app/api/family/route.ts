import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ApiError, handleApiError, optString, reqString, requireUserId } from '@/lib/api-helpers'
import { groupWithMembersToDTO } from '@/lib/dto'

export const runtime = 'nodejs'

/** Алфавит без неоднозначных символов (без O/0/I/1) */
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const INVITE_LENGTH = 6
const INVITE_ATTEMPTS = 5

function randomInviteCode(): string {
  let code = ''
  for (let i = 0; i < INVITE_LENGTH; i++) {
    code += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)]
  }
  return code
}

/** Генерирует уникальный код приглашения (до 5 попыток) */
async function generateUniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < INVITE_ATTEMPTS; attempt++) {
    const candidate = randomInviteCode()
    const existing = await db.familyGroup.findUnique({ where: { inviteCode: candidate } })
    if (!existing) return candidate
  }
  throw new ApiError(500, 'Не удалось сгенерировать код приглашения, попробуйте ещё раз')
}

/** GET /api/family — все группы пользователя (где он член) */
export async function GET() {
  try {
    const userId = await requireUserId()

    const memberships = await db.familyMember.findMany({
      where: { userId },
      select: { groupId: true },
    })
    const groupIds = memberships.map((m) => m.groupId)

    const groups = await db.familyGroup.findMany({
      where: { id: { in: groupIds } },
      include: { members: { include: { user: true } } },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(groups.map(groupWithMembersToDTO))
  } catch (e) {
    return handleApiError(e)
  }
}

/** POST /api/family — создать группу (создатель становится владельцем) */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId()

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      throw new ApiError(400, 'Некорректное тело запроса')
    }

    const name = reqString(body, 'name', { min: 1, max: 60 })
    const description = optString(body, 'description', 300)
    const inviteCode = await generateUniqueInviteCode()

    const group = await db.familyGroup.create({
      data: {
        name,
        description,
        inviteCode,
        ownerId: userId,
        members: { create: { userId, role: 'owner' } },
      },
      include: { members: { include: { user: true } } },
    })

    return NextResponse.json(groupWithMembersToDTO(group), { status: 201 })
  } catch (e) {
    return handleApiError(e)
  }
}
