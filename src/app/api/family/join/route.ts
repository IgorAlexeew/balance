import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ApiError, handleApiError, reqString, requireUserId } from '@/lib/api-helpers'
import { groupWithMembersToDTO } from '@/lib/dto'

export const runtime = 'nodejs'

/** POST /api/family/join — вступить в группу по коду приглашения */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId()

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      throw new ApiError(400, 'Некорректное тело запроса')
    }

    const inviteCode = reqString(body, 'inviteCode').trim().toUpperCase()

    const group = await db.familyGroup.findUnique({ where: { inviteCode } })
    if (!group) {
      throw new ApiError(404, 'Группа по этому коду не найдена')
    }

    const existing = await db.familyMember.findFirst({ where: { groupId: group.id, userId } })
    if (existing) {
      throw new ApiError(409, 'Вы уже состоите в этой группе')
    }

    await db.familyMember.create({
      data: { groupId: group.id, userId, role: 'member' },
    })

    const updated = await db.familyGroup.findUnique({
      where: { id: group.id },
      include: { members: { include: { user: true } } },
    })
    if (!updated) {
      throw new ApiError(500, 'Не удалось загрузить группу')
    }

    return NextResponse.json(groupWithMembersToDTO(updated))
  } catch (e) {
    return handleApiError(e)
  }
}
