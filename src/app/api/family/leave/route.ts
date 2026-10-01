import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ApiError, handleApiError, reqString, requireUserId } from '@/lib/api-helpers'

export const runtime = 'nodejs'

/** POST /api/family/leave — выйти из группы (владелец передаёт её или удаляет) */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId()

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      throw new ApiError(400, 'Некорректное тело запроса')
    }

    const groupId = reqString(body, 'groupId')

    const membership = await db.familyMember.findFirst({ where: { groupId, userId } })
    const group = await db.familyGroup.findUnique({ where: { id: groupId } })
    if (!membership || !group) {
      throw new ApiError(404, 'Вы не состоите в этой группе')
    }

    // Не владелец — просто выходим
    if (group.ownerId !== userId) {
      await db.familyMember.delete({ where: { id: membership.id } })
      return NextResponse.json({ ok: true })
    }

    // Владелец: есть другие члены — передаём владение самому раннему
    const others = await db.familyMember.findMany({
      where: { groupId, userId: { not: userId } },
      orderBy: { createdAt: 'asc' },
    })

    if (others.length > 0) {
      const heir = others[0]
      await db.$transaction([
        db.familyMember.update({ where: { id: heir.id }, data: { role: 'owner' } }),
        db.familyGroup.update({ where: { id: groupId }, data: { ownerId: heir.userId } }),
        db.familyMember.delete({ where: { id: membership.id } }),
      ])
      return NextResponse.json({ ok: true })
    }

    // Владелец и других членов нет — удаляем группу целиком (каскад)
    await db.familyGroup.delete({ where: { id: groupId } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}
