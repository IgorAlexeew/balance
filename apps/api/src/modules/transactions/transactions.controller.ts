import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import type { User } from '@prisma/client'
import {
  budgetQuerySchema,
  idSchema,
  transactionCreateSchema,
  transactionUpdateSchema,
} from '@balance/contracts'
import type { z } from 'zod'
import { CurrentUser } from '../../common/decorators'
import { ZodPipe } from '../../common/zod.pipe'
import { TransactionsService } from './transactions.service'

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query(new ZodPipe(budgetQuerySchema)) q: z.output<typeof budgetQuerySchema>,
  ) {
    return this.transactions.list(user.id, q.month, q.groupId)
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @Body(new ZodPipe(transactionCreateSchema)) input: z.output<typeof transactionCreateSchema>,
  ) {
    return this.transactions.create(user.id, input)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', new ZodPipe(idSchema)) id: string,
    @Body(new ZodPipe(transactionUpdateSchema)) input: z.output<typeof transactionUpdateSchema>,
  ) {
    return this.transactions.update(user.id, id, input)
  }

  @Delete(':id')
  async remove(@CurrentUser() user: User, @Param('id', new ZodPipe(idSchema)) id: string) {
    await this.transactions.remove(user.id, id)
    return { ok: true }
  }
}
