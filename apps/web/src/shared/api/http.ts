import type { ApiErrorBody } from '@balance/contracts'

/** Ошибка запроса к API с HTTP-статусом и сообщением сервера */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function isApiError(e: unknown, status?: number): e is ApiError {
  return e instanceof ApiError && (status === undefined || e.status === status)
}

type QueryValue = string | number | boolean | null | undefined

export function withQuery(path: string, params: Record<string, QueryValue>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue
    search.set(key, String(value))
  }
  const s = search.toString()
  return s ? `${path}?${s}` : path
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Нет соединения с сервером')
  }
  const data: unknown = res.headers.get('content-type')?.includes('application/json')
    ? await res.json().catch(() => null)
    : null
  if (!res.ok) {
    const message = (data as Partial<ApiErrorBody> | null)?.error ?? `Ошибка запроса (${res.status})`
    throw new ApiError(res.status, message)
  }
  return data as T
}

export const http = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T = { ok: true }>(path: string) => request<T>('DELETE', path),
}
