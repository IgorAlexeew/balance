import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import type { User } from '@prisma/client'
import { eventCreateSchema, eventListQuerySchema, eventUpdateSchema, idSchema } from '@balance/contracts'
import type { z } from 'zod'
import { CurrentUser } from '../../common/decorators'
import { ZodPipe } from '../../common/zod.pipe'
import { EventsService } from './events.service'

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query(new ZodPipe(eventListQuerySchema)) q: z.output<typeof eventListQuerySchema>,
  ) {
    return this.events.list(user.id, q)
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @Body(new ZodPipe(eventCreateSchema)) input: z.output<typeof eventCreateSchema>,
  ) {
    return this.events.create(user.id, input)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', new ZodPipe(idSchema)) id: string,
    @Body(new ZodPipe(eventUpdateSchema)) input: z.output<typeof eventUpdateSchema>,
  ) {
    return this.events.update(user.id, id, input)
  }

  @Delete(':id')
  async remove(@CurrentUser() user: User, @Param('id', new ZodPipe(idSchema)) id: string) {
    await this.events.remove(user.id, id)
    return { ok: true }
  }
}
