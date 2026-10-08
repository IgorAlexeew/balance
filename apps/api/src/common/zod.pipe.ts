import { PipeTransform } from '@nestjs/common'
import type { z, ZodType } from 'zod'
import { ApiError } from './api-error'

/** Валидация входа zod-схемой из @balance/contracts; ошибка — 400 с первым сообщением */
export class ZodPipe<S extends ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value)
    if (!result.success) throw new ApiError(400, result.error.issues[0]?.message ?? 'Некорректный запрос')
    return result.data
  }
}
