import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import {
  ApiError,
  assertGroupAccess,
  handleApiError,
  monthRange,
  parseMonthParam,
  requireUserId,
} from '@/lib/api-helpers'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * POST /api/budget/ai-analysis
 * Body: { month: "YYYY-MM", groupId?: string | null }
 * Возвращает { analysis } — markdown-разбор покупок за месяц от LLM.
 */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId()
    const body = (await req.json().catch(() => ({}))) as {
      month?: unknown
      groupId?: unknown
    }

    const month = parseMonthParam(typeof body.month === 'string' ? body.month : null)
    const groupId = typeof body.groupId === 'string' && body.groupId ? body.groupId : null

    if (groupId) await assertGroupAccess(userId, groupId)

    const { start, end } = monthRange(month)
    const transactions = await db.transaction.findMany({
      where: groupId
        ? { groupId, date: { gte: start, lt: end } }
        : { userId, groupId: null, date: { gte: start, lt: end } },
      include: { user: { select: { name: true } } },
      orderBy: { date: 'asc' },
    })

    if (transactions.length === 0) {
      throw new ApiError(400, 'За этот месяц нет записей для анализа')
    }

    // Компактное представление данных для LLM
    const lines = transactions.map((t) => {
      const date = t.date.toISOString().slice(0, 10)
      const who = groupId ? (t.user?.name ?? '—') : null
      return [
        date,
        t.type === 'income' ? 'доход' : 'расход',
        `${Math.round(t.amount)} руб.`,
        t.category,
        t.description ?? '',
        who ?? '',
      ]
        .filter(Boolean)
        .join(' | ')
    })

    const [y, m] = month.split('-').map(Number)
    const monthName = new Intl.DateTimeFormat('ru-RU', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(y, m - 1, 15)))

    const totalIncome = transactions
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0)
    const totalExpense = transactions
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)

    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content:
            'Ты — дружелюбный финансовый аналитик семейного бюджета. Тебе дают список операций за месяц ' +
            '(формат: дата | тип | сумма | категория | описание | кто). Проанализируй покупки и дай полезный разбор на русском языке в Markdown. ' +
            'Структура ответа:\n' +
            '## Краткие итоги\nОдно-два предложения: сколько заработали, потратили и остаток.\n' +
            '## Куда уходят деньги\nРазбор топ-3–5 категорий расходов с процентами от общих трат и наблюдениями.\n' +
            '## Что бросается в глаза\nНеочевидные закономерности: частые мелкие траты, крупные разовые покупки, дни недели, повторяющиеся платежи.\n' +
            '## Рекомендации\n3–4 конкретных и выполнимых совета по экономии или перераспределению бюджета.\n\n' +
            'Правила: пиши по-русски, суммы в рублях (можно округлять), проценты округляй до целых, ' +
            'обращайся к пользователю на «вы», дружелюбно и без осуждения. Объём — до 350 слов. Не выдумывай данные, которых нет. ' +
            'Если транзакций мало, дай более короткий, но всё равно полезный разбор.',
        },
        {
          role: 'user',
          content:
            `Проанализируй бюджет за ${monthName}.\n\n` +
            `Всего записей: ${transactions.length}. Доходы: ${Math.round(totalIncome)} руб. Расходы: ${Math.round(totalExpense)} руб.\n\n` +
            `Операции:\n${lines.join('\n')}`,
        },
      ],
      thinking: { type: 'disabled' },
    })

    const analysis = completion.choices[0]?.message?.content?.trim()
    if (!analysis) {
      throw new ApiError(502, 'ИИ не смог подготовить анализ. Попробуйте ещё раз.')
    }

    return NextResponse.json({ analysis })
  } catch (e) {
    return handleApiError(e)
  }
}
