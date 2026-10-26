import { Module } from '@nestjs/common'
import { RemindersModule } from '../reminders/reminders.module'
import { FamilyController } from './family.controller'
import { FamilyService } from './family.service'

@Module({ imports: [RemindersModule], controllers: [FamilyController], providers: [FamilyService] })
export class FamilyModule {}
