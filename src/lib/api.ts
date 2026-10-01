import type {
  BudgetSummaryDTO,
  CalendarEventDTO,
  CalendarEventInput,
  FamilyGroupDTO,
  TaskDTO,
  TaskFilterStatus,
  TaskInput,
  TransactionDTO,
  TransactionInput,
  UserNotificationDTO,
} from '@/lib/types'

/** Типизированный клиент API LifeBalance */

class ApiRequestError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    let message = `Ошибка запроса (${res.status})`
    try {
      const data = (await res.json()) as { error?: string }
      if (data?.error) message = data.error
    } catch {
      /* игнорируем ошибки парсинга */
    }
    throw new ApiRequestError(res.status, message)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue
    search.set(key, String(value))
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

/** groupId для запросов: null → параметр не отправляется (личный контекст) */
function groupParam(groupId: string | null): string | null {
  return groupId ?? null
}

export const api = {
  tasks: {
    list(params: { status?: TaskFilterStatus; scope?: 'personal' | 'all' | string } = {}): Promise<TaskDTO[]> {
      return request<TaskDTO[]>(`/api/tasks${qs({ status: params.status, scope: params.scope })}`)
    },
    create(input: TaskInput): Promise<TaskDTO> {
      return request<TaskDTO>('/api/tasks', { method: 'POST', body: JSON.stringify(input) })
    },
    update(id: string, patch: Partial<TaskInput>): Promise<TaskDTO> {
      return request<TaskDTO>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    },
    remove(id: string): Promise<void> {
      return request<void>(`/api/tasks/${id}`, { method: 'DELETE' })
    },
  },

  reminders: {
    /** tz — смещение часового пояса в минутах, как в -new Date().getTimezoneOffset() */
    due(tzMinutes: number): Promise<UserNotificationDTO[]> {
      return request<UserNotificationDTO[]>(`/api/reminders/due${qs({ tz: tzMinutes })}`)
    },
  },

  notifications: {
    list(unread = false): Promise<UserNotificationDTO[]> {
      return request<UserNotificationDTO[]>(`/api/notifications${qs({ unread: unread ? 1 : null })}`)
    },
    markRead(opts: { ids?: string[]; all?: boolean }): Promise<void> {
      return request<void>('/api/notifications', { method: 'PATCH', body: JSON.stringify(opts) })
    },
  },

  transactions: {
    list(params: { month: string; groupId: string | null }): Promise<TransactionDTO[]> {
      return request<TransactionDTO[]>(
        `/api/transactions${qs({ month: params.month, groupId: groupParam(params.groupId) })}`
      )
    },
    create(input: TransactionInput): Promise<TransactionDTO> {
      return request<TransactionDTO>('/api/transactions', { method: 'POST', body: JSON.stringify(input) })
    },
    update(id: string, patch: Partial<TransactionInput>): Promise<TransactionDTO> {
      return request<TransactionDTO>(`/api/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    },
    remove(id: string): Promise<void> {
      return request<void>(`/api/transactions/${id}`, { method: 'DELETE' })
    },
  },

  budget: {
    summary(params: { month: string; groupId: string | null }): Promise<BudgetSummaryDTO> {
      return request<BudgetSummaryDTO>(
        `/api/budget/summary${qs({ month: params.month, groupId: groupParam(params.groupId) })}`
      )
    },
    /** ИИ-анализ покупок за месяц (LLM) */
    aiAnalysis(params: { month: string; groupId: string | null }): Promise<{ analysis: string }> {
      return request<{ analysis: string }>('/api/budget/ai-analysis', {
        method: 'POST',
        body: JSON.stringify({ month: params.month, groupId: params.groupId }),
      })
    },
  },

  events: {
    list(params: { from: string; to: string; groupId: string | null }): Promise<CalendarEventDTO[]> {
      return request<CalendarEventDTO[]>(
        `/api/events${qs({ from: params.from, to: params.to, groupId: groupParam(params.groupId) })}`
      )
    },
    create(input: CalendarEventInput): Promise<CalendarEventDTO> {
      return request<CalendarEventDTO>('/api/events', { method: 'POST', body: JSON.stringify(input) })
    },
    update(id: string, patch: Partial<CalendarEventInput>): Promise<CalendarEventDTO> {
      return request<CalendarEventDTO>(`/api/events/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    },
    remove(id: string): Promise<void> {
      return request<void>(`/api/events/${id}`, { method: 'DELETE' })
    },
  },

  family: {
    list(): Promise<FamilyGroupDTO[]> {
      return request<FamilyGroupDTO[]>('/api/family')
    },
    create(input: { name: string; description?: string | null }): Promise<FamilyGroupDTO> {
      return request<FamilyGroupDTO>('/api/family', { method: 'POST', body: JSON.stringify(input) })
    },
    join(inviteCode: string): Promise<FamilyGroupDTO> {
      return request<FamilyGroupDTO>('/api/family/join', { method: 'POST', body: JSON.stringify({ inviteCode }) })
    },
    leave(groupId: string): Promise<void> {
      return request<void>('/api/family/leave', { method: 'POST', body: JSON.stringify({ groupId }) })
    },
    remove(groupId: string): Promise<void> {
      return request<void>(`/api/family/${groupId}`, { method: 'DELETE' })
    },
  },
}

export { ApiRequestError }
