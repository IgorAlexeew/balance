import type { FamilyCreateInput, FamilyGroupDTO } from '@balance/contracts'
import { http } from '@/shared/api'

export const familyApi = {
  list: () => http.get<FamilyGroupDTO[]>('/family'),
  create: (input: FamilyCreateInput) => http.post<FamilyGroupDTO>('/family', input),
  join: (inviteCode: string) => http.post<FamilyGroupDTO>('/family/join', { inviteCode }),
  leave: (groupId: string) => http.post<{ ok: true }>(`/family/${groupId}/leave`),
  remove: (groupId: string) => http.delete(`/family/${groupId}`),
  regenerateInviteCode: (groupId: string) => http.post<FamilyGroupDTO>(`/family/${groupId}/invite-code`),
}
