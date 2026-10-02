import { Body, Controller, Get, HttpCode, Logger, Post, Query, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { User } from '@prisma/client'
import { budgetQuerySchema, type BudgetAnalysisDTO, type BudgetSummaryDTO } from '@balance/contracts'
import type { z } from 'zod'
import { ApiError, badRequest } from '../../common/api-error'
import { CurrentUser } from '../../common/decorators'
import { UserThrottlerGuard } from '../../common/user-throttler.guard'
import { ZodPipe } from '../../common/zod.pipe'
import { PrismaService } from '../../prisma/prisma.service'
import { TransactionsService } from '../transactions/transactions.service'
import { AiService, BUDGET_ANALYST_PROMPT } from './ai.service'
import { buildBudgetSummary } from './budget-summary'

type BudgetQuery = z.output<typeof budgetQuerySchema>
const rub = (kopecks: number) => `${Math.round(kopecks / 100)} руб.`

@Controller('budget')
export class BudgetController {
  private readonly logger = new Logger(BudgetController.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionsService,
    private readonly ai: AiService,
  ) {}

  @Get('summary')
  async summary(
    @CurrentUser() user: User,
    @Query(new ZodPipe(budgetQuerySchema)) q: BudgetQuery,
  ): Promise<BudgetSummaryDTO> {
    const rows = await this.prisma.transaction.findMany({
      where: await this.transactions.monthWhere(user.id, q.month, q.groupId),
      select: { type: true, amount: true, category: true, date: true },
    })
    return buildBudgetSummary(q.month, rows)
  }

  @Post('analysis')
  @HttpCode(200)
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60 * 60 * 1000 } })
  async analysis(
    @CurrentUser() user: User,
    @Body(new ZodPipe(budgetQuerySchema)) q: BudgetQuery,
  ): Promise<BudgetAnalysisDTO> {
    if (!this.ai.enabled) throw new ApiError(503, 'ИИ-анализ не настроен на сервере')
    const rows = await this.prisma.transaction.findMany({
      where: await this.transactions.monthWhere(user.id, q.month, q.groupId),
      include: { user: { select: { name: true } } },
      orderBy: { date: 'asc' },
      take: 1000,
    })
    if (rows.length === 0) throw badRequest('За этот месяц нет записей для анализа')

    const summary = buildBudgetSummary(q.month, rows)
    const lines = rows.map((t) =>
      [
        t.date,
        t.type === 'income' ? 'доход' : 'расход',
        rub(t.amount),
        t.category,
        t.description ?? '',
        q.groupId ? (t.user.name?.split(' ')[0] ?? '') : '',
      ]
        .filter(Boolean)
        .join(' | '),
    )

    let analysis: string
    try {
      analysis = await this.ai.complete([
        { role: 'system', content: BUDGET_ANALYST_PROMPT },
        {
          role: 'user',
          content:
            `Месяц: ${q.month}. Записей: ${rows.length}. Доходы: ${rub(summary.totalIncome)}. ` +
            `Расходы: ${rub(summary.totalExpense)}.\n\nОперации:\n${lines.join('\n')}`,
        },
      ])
    } catch (e) {
      this.logger.error(`AI analysis failed: ${String(e)}`)
      throw new ApiError(502, 'ИИ-сервис недоступен, попробуйте позже')
    }
    if (!analysis) throw new ApiError(502, 'ИИ не смог подготовить анализ, попробуйте ещё раз')
    return { analysis }
  }
}
