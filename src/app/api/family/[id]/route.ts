import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ApiError, handleApiError, parseIdParam, requireUserId } from '@/lib/api-helpers'

export const runtime = 'nodejs'

/** DELETE /api/family/[id] — удалить группу (только владелец, каскадное удаление данных группы) */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId()
    const id = parseIdParam(await params)

    const group = await db.familyGroup.findUnique({ where: { id } })
    if (!group) {
      throw new ApiError(404, 'Группа не найдена')
    }
    if (group.ownerId !== userId) {
      throw new ApiError(403, 'Удалить группу может только владелец')
    }

    await db.familyGroup.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}
