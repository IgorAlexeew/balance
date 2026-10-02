import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import type { User } from '@prisma/client'
import { idSchema, taskCreateSchema, taskListQuerySchema, taskUpdateSchema } from '@balance/contracts'
import type { z } from 'zod'
import { CurrentUser } from '../../common/decorators'
import { ZodPipe } from '../../common/zod.pipe'
import { TasksService } from './tasks.service'

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query(new ZodPipe(taskListQuerySchema)) q: z.output<typeof taskListQuerySchema>,
  ) {
    return this.tasks.list(user.id, q.status, q.scope)
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @Body(new ZodPipe(taskCreateSchema)) input: z.output<typeof taskCreateSchema>,
  ) {
    return this.tasks.create(user.id, input)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', new ZodPipe(idSchema)) id: string,
    @Body(new ZodPipe(taskUpdateSchema)) input: z.output<typeof taskUpdateSchema>,
  ) {
    return this.tasks.update(user.id, id, input)
  }

  @Delete(':id')
  async remove(@CurrentUser() user: User, @Param('id', new ZodPipe(idSchema)) id: string) {
    await this.tasks.remove(user.id, id)
    return { ok: true }
  }
}
