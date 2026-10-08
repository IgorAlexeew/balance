import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { SessionsService } from './sessions.service'

@Injectable()
export class SessionsCleanup {
  private readonly logger = new Logger(SessionsCleanup.name)

  constructor(private readonly sessions: SessionsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async purge(): Promise<void> {
    const removed = await this.sessions.purgeExpired()
    if (removed) this.logger.log(`Removed ${removed} expired sessions`)
  }
}
