import type { CalendarEventDTO, EventCreateInput, EventUpdateInput } from '@balance/contracts'
import { http, withQuery } from '@/shared/api'

export const eventApi = {
  list: (from: string, to: string, groupId: string | null) =>
    http.get<CalendarEventDTO[]>(withQuery('/events', { from, to, groupId })),
  create: (input: EventCreateInput) => http.post<CalendarEventDTO>('/events', input),
  update: (id: string, input: EventUpdateInput) => http.patch<CalendarEventDTO>(`/events/${id}`, input),
  remove: (id: string) => http.delete(`/events/${id}`),
}
