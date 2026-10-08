import { Body, Controller, Get, Patch } from '@nestjs/common'
import type { User } from '@prisma/client'
import { meUpdateSchema, type MeUpdateInput, type UserDTO } from '@balance/contracts'
import { CurrentUser } from '../../common/decorators'
import { ZodPipe } from '../../common/zod.pipe'
import { PrismaService } from '../../prisma/prisma.service'
import { userToDTO } from '../auth/user.mapper'
import { RemindersService } from '../reminders/reminders.service'

@Controller('me')
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reminders: RemindersService,
  ) {}

  @Get()
  get(@CurrentUser() user: User): UserDTO {
    return userToDTO(user)
  }

  @Patch()
  async update(
    @CurrentUser() user: User,
    @Body(new ZodPipe(meUpdateSchema)) input: MeUpdateInput,
  ): Promise<UserDTO> {
    const updated = await this.prisma.user.update({ where: { id: user.id }, data: input })
    // Ежедневные/еженедельные напоминания считаются в зоне пользователя
    if (input.timezone && input.timezone !== user.timezone) {
      await this.reminders.rescheduleForUser(user.id)
    }
    return userToDTO(updated)
  }
}
