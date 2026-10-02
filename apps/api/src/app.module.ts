import { DynamicModule, Module } from '@nestjs/common'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'
import { ThrottlerModule } from '@nestjs/throttler'
import { AllExceptionsFilter } from './common/all-exceptions.filter'
import { CsrfGuard } from './common/csrf.guard'
import { APP_CONFIG, type AppConfig } from './config/app-config'
import { AccessModule } from './modules/access/access.module'
import { AuthModule } from './modules/auth/auth.module'
import { SessionGuard } from './modules/auth/session.guard'
import { BudgetModule } from './modules/budget/budget.module'
import { EventsModule } from './modules/events/events.module'
import { FamilyModule } from './modules/family/family.module'
import { MeModule } from './modules/me/me.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { RemindersModule } from './modules/reminders/reminders.module'
import { TasksModule } from './modules/tasks/tasks.module'
import { TransactionsModule } from './modules/transactions/transactions.module'
import { PrismaModule } from './prisma/prisma.module'

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [
        // Фоновые задачи (@Interval/@Cron) активны только при подключённом ScheduleModule
        ...(config.schedulerEnabled ? [ScheduleModule.forRoot()] : []),
        // Лимиты задаются на конкретных эндпоинтах через @Throttle + UserThrottlerGuard
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
        PrismaModule,
        AccessModule,
        AuthModule,
        MeModule,
        RemindersModule,
        TasksModule,
        TransactionsModule,
        BudgetModule,
        EventsModule,
        FamilyModule,
        NotificationsModule,
      ],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        // Порядок важен: сначала CSRF, затем сессия
        { provide: APP_GUARD, useClass: CsrfGuard },
        { provide: APP_GUARD, useClass: SessionGuard },
      ],
      exports: [APP_CONFIG],
    }
  }
}
