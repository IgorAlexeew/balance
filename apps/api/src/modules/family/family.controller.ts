import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { User } from '@prisma/client'
import { familyCreateSchema, familyJoinSchema, idSchema } from '@balance/contracts'
import type { z } from 'zod'
import { CurrentUser } from '../../common/decorators'
import { UserThrottlerGuard } from '../../common/user-throttler.guard'
import { ZodPipe } from '../../common/zod.pipe'
import { FamilyService } from './family.service'

@Controller('family')
export class FamilyController {
  constructor(private readonly family: FamilyService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.family.list(user.id)
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @Body(new ZodPipe(familyCreateSchema)) input: z.output<typeof familyCreateSchema>,
  ) {
    return this.family.create(user.id, input)
  }

  @Post('join')
  @HttpCode(200)
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 10 * 60 * 1000 } })
  join(
    @CurrentUser() user: User,
    @Body(new ZodPipe(familyJoinSchema)) input: z.output<typeof familyJoinSchema>,
  ) {
    return this.family.join(user.id, input.inviteCode)
  }

  @Post(':id/invite-code')
  @HttpCode(200)
  regenerateInviteCode(@CurrentUser() user: User, @Param('id', new ZodPipe(idSchema)) id: string) {
    return this.family.regenerateInviteCode(user.id, id)
  }

  @Post(':id/leave')
  @HttpCode(200)
  async leave(@CurrentUser() user: User, @Param('id', new ZodPipe(idSchema)) id: string) {
    await this.family.leave(user.id, id)
    return { ok: true }
  }

  @Delete(':id')
  async remove(@CurrentUser() user: User, @Param('id', new ZodPipe(idSchema)) id: string) {
    await this.family.remove(user.id, id)
    return { ok: true }
  }
}
