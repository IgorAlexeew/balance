/** Ошибка API с HTTP-статусом и сообщением для пользователя */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export const badRequest = (message: string) => new ApiError(400, message)
export const forbidden = (message = 'Недостаточно прав') => new ApiError(403, message)
export const notFound = (message = 'Не найдено') => new ApiError(404, message)
