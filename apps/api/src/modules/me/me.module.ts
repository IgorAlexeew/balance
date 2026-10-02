import { Module } from '@nestjs/common'
import { RemindersModule } from '../reminders/reminders.module'
import { MeController } from './me.controller'

@Module({ imports: [RemindersModule], controllers: [MeController] })
export class MeModule {}
