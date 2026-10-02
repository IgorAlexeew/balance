import { Hono } from 'hono'
import { budgetQuerySchema, type BudgetAnalysisDTO } from '@balance/contracts'
import { prisma } from '../../db'
import { ApiError, badRequest } from '../../lib/errors'
import { rateLimit } from '../../lib/rate-limit'
import { validate } from '../../lib/validate'
import { requireUser } from '../../middleware/session'
import type { AppEnv } from '../../types'
import { monthDateRange, transactionScopeWhere } from '../transactions/scope'
import { BUDGET_ANALYST_PROMPT, chatCompletion } from './ai'
import { buildBudgetSummary } from './summary'

const rub = (kopecks: number) => `${Math.round(kopecks / 100)} руб.`

export const budgetRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .get('/summary', validate('query', budgetQuerySchema), async (c) => {
    const { month, groupId } = c.req.valid('query')
    const { from, to } = monthDateRange(month)
    const scope = await transactionScopeWhere(c.get('user').id, groupId)
    const rows = await prisma.transaction.findMany({
      where: { ...scope, date: { gte: from, lt: to } },
      select: { type: true, amount: true, category: true, date: true },
    })
    return c.json(buildBudgetSummary(month, rows))
  })

  .post(
    '/analysis',
    rateLimit({ name: 'ai', limit: 10, windowMs: 60 * 60 * 1000, message: 'Слишком много запросов к ИИ, попробуйте позже' }),
    validate('json', budgetQuerySchema),
    async (c) => {
      const ai = c.get('config').ai
      if (!ai) throw new ApiError(503, 'ИИ-анализ не настроен на сервере')
      const { month, groupId } = c.req.valid('json')
      const { from, to } = monthDateRange(month)
      const scope = await transactionScopeWhere(c.get('user').id, groupId)
      const rows = await prisma.transaction.findMany({
        where: { ...scope, date: { gte: from, lt: to } },
        include: { user: { select: { name: true } } },
        orderBy: { date: 'asc' },
        take: 1000,
      })
      if (rows.length === 0) throw badRequest('За этот месяц нет записей для анализа')

      const summary = buildBudgetSummary(month, rows)
      const lines = rows.map((t) =>
        [
          t.date,
          t.type === 'income' ? 'доход' : 'расход',
          rub(t.amount),
          t.category,
          t.description ?? '',
          groupId ? (t.user.name?.split(' ')[0] ?? '') : '',
        ]
          .filter(Boolean)
          .join(' | '),
      )

      let analysis: string
      try {
        analysis = await chatCompletion(ai, [
          { role: 'system', content: BUDGET_ANALYST_PROMPT },
          {
            role: 'user',
            content:
              `Месяц: ${month}. Записей: ${rows.length}. Доходы: ${rub(summary.totalIncome)}. ` +
              `Расходы: ${rub(summary.totalExpense)}.\n\nОперации:\n${lines.join('\n')}`,
          },
        ])
      } catch (e) {
        console.error('[budget] AI analysis failed', e)
        throw new ApiError(502, 'ИИ-сервис недоступен, попробуйте позже')
      }
      if (!analysis) throw new ApiError(502, 'ИИ не смог подготовить анализ, попробуйте ещё раз')
      const body: BudgetAnalysisDTO = { analysis }
      return c.json(body)
    },
  )
