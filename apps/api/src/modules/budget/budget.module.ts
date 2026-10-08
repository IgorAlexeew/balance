import { Module } from '@nestjs/common'
import { TransactionsModule } from '../transactions/transactions.module'
import { AiService } from './ai.service'
import { BudgetController } from './budget.controller'

@Module({ imports: [TransactionsModule], controllers: [BudgetController], providers: [AiService] })
export class BudgetModule {}
