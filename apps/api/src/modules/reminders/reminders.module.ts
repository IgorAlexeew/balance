import { Module } from '@nestjs/common'
import { RemindersScheduler } from './reminders.scheduler'
import { RemindersService } from './reminders.service'

@Module({
  providers: [RemindersService, RemindersScheduler],
  exports: [RemindersService, RemindersScheduler],
})
export class RemindersModule {}
