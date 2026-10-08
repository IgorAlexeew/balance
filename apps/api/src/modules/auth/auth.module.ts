import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { SessionsCleanup } from './sessions.cleanup'
import { SessionsService } from './sessions.service'

@Module({
  controllers: [AuthController],
  providers: [SessionsService, SessionsCleanup],
  exports: [SessionsService],
})
export class AuthModule {}
