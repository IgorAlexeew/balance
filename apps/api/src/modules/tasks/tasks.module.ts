import { Module } from '@nestjs/common'
import { RemindersModule } from '../reminders/reminders.module'
import { TasksController } from './tasks.controller'
import { TasksService } from './tasks.service'

@Module({ imports: [RemindersModule], controllers: [TasksController], providers: [TasksService] })
export class TasksModule {}
